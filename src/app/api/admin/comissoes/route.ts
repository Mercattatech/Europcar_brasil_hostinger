import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];

async function checkAdmin() {
   const session = await getServerSession(authOptions);
   if (!session?.user?.email) return false;
   if (ADMIN_EMAILS.includes(session.user.email)) return true;
   const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
   return dbUser?.role === 'ADMIN';
}

export async function GET(request: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const { searchParams } = new URL(request.url);
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      const dateFilter: any = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) {
         const end = new Date(endDate);
         end.setHours(23, 59, 59, 999);
         dateFilter.lte = end;
      }

      const resWhere: any = {
         status: { not: 'CANCELLED' } // Canceladas não entram na conta
      };
      if (Object.keys(dateFilter).length > 0) {
         resWhere.createdAt = dateFilter;
      }

      // 1. Get Commission Rate
      const config = await prisma.contentBlock.findUnique({ where: { key: 'COMMISSION_RATE' } });
      const rate = config?.value_ptBR ? parseFloat(config.value_ptBR) : 0;

      // 2. Fetch valid reservations
      const reservations = await prisma.localReservation.findMany({
         where: resWhere,
         orderBy: { createdAt: 'desc' }
      });

      // 3. Process and calculate
      let totalComissao = 0;
      let totalVendas = 0;
      const grouped = {
         'CREDIT_CARD': { vendas: 0, comissao: 0, count: 0 },
         'PIX': { vendas: 0, comissao: 0, count: 0 },
         'BALCAO': { vendas: 0, comissao: 0, count: 0 }
      };

      const resultList = reservations.map(res => {
         const valor = res.amountInCents ? res.amountInCents / 100 : 0;
         const comissao = valor * (rate / 100);
         
         let tipo = 'BALCAO';
         if (res.status === 'CONFIRMED_PREPAID') tipo = 'CREDIT_CARD';
         if (res.status === 'PENDING_PIX') tipo = 'PIX';

         // Update totals
         totalVendas += valor;
         totalComissao += comissao;
         
         if (tipo === 'CREDIT_CARD') {
            grouped.CREDIT_CARD.vendas += valor;
            grouped.CREDIT_CARD.comissao += comissao;
            grouped.CREDIT_CARD.count += 1;
         } else if (tipo === 'PIX') {
            grouped.PIX.vendas += valor;
            grouped.PIX.comissao += comissao;
            grouped.PIX.count += 1;
         } else {
            grouped.BALCAO.vendas += valor;
            grouped.BALCAO.comissao += comissao;
            grouped.BALCAO.count += 1;
         }

         return {
            ...res,
            valorCalculado: valor,
            comissaoCalculada: comissao,
            tipoPagamento: tipo
         };
      });

      return NextResponse.json({
         rate,
         totalComissao,
         totalVendas,
         grouped,
         reservations: resultList
      });

   } catch (error: any) {
      console.error('Comissoes API error:', error);
      return NextResponse.json({ error: 'Erro ao gerar relatório' }, { status: 500 });
   }
}
