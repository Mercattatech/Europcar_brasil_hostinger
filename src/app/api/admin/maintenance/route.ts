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

// GET — Retorna a configuração atual de manutenção
export async function GET() {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const config = await prisma.maintenanceConfig.findFirst({
         orderBy: { updatedAt: 'desc' }
      });
      return NextResponse.json(config || { redirectUrl: '', isActive: false, returnDate: null, reason: '' });
   } catch (error: any) {
      console.error('Maintenance API error:', error);
      return NextResponse.json({ error: 'Erro ao carregar configuração' }, { status: 500 });
   }
}

// POST — Cria ou atualiza a configuração de manutenção
export async function POST(request: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const { redirectUrl, isActive, returnDate, reason } = await request.json();

      if (!redirectUrl || typeof redirectUrl !== 'string') {
         return NextResponse.json({ error: 'URL de redirecionamento é obrigatória' }, { status: 400 });
      }

      // Validate URL format
      try {
         new URL(redirectUrl);
      } catch {
         return NextResponse.json({ error: 'URL inválida. Insira uma URL completa (ex: https://exemplo.com)' }, { status: 400 });
      }

      const existing = await prisma.maintenanceConfig.findFirst({
         orderBy: { updatedAt: 'desc' }
      });

      let config;
      if (existing) {
         config = await prisma.maintenanceConfig.update({
            where: { id: existing.id },
            data: {
               redirectUrl,
               isActive: isActive ?? false,
               returnDate: returnDate ? new Date(returnDate) : null,
               reason: reason || null,
            }
         });
      } else {
         config = await prisma.maintenanceConfig.create({
            data: {
               redirectUrl,
               isActive: isActive ?? false,
               returnDate: returnDate ? new Date(returnDate) : null,
               reason: reason || null,
            }
         });
      }

      return NextResponse.json({ success: true, config });
   } catch (error: any) {
      console.error('Maintenance API error:', error);
      return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 });
   }
}

// PATCH — Toggle ativar/desativar manutenção
export async function PATCH(request: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const { isActive } = await request.json();

      const existing = await prisma.maintenanceConfig.findFirst({
         orderBy: { updatedAt: 'desc' }
      });

      if (!existing) {
         return NextResponse.json({ error: 'Nenhuma configuração encontrada. Cadastre uma URL primeiro.' }, { status: 404 });
      }

      const config = await prisma.maintenanceConfig.update({
         where: { id: existing.id },
         data: { isActive: Boolean(isActive) }
      });

      return NextResponse.json({ success: true, config });
   } catch (error: any) {
      console.error('Maintenance API error:', error);
      return NextResponse.json({ error: 'Erro ao atualizar status' }, { status: 500 });
   }
}
