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
      const key = searchParams.get('key');
      if (!key) return NextResponse.json({ error: 'Key is required' }, { status: 400 });

      const config = await prisma.contentBlock.findUnique({ where: { key } });
      return NextResponse.json({ value: config?.value_ptBR || null });
   } catch (error: any) {
      console.error('Config API error:', error);
      return NextResponse.json({ error: 'Erro ao carregar configuração' }, { status: 500 });
   }
}

export async function POST(request: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const { key, value } = await request.json();
      if (!key) return NextResponse.json({ error: 'Key is required' }, { status: 400 });

      const config = await prisma.contentBlock.upsert({
         where: { key },
         update: { value_ptBR: String(value) },
         create: { key, value_ptBR: String(value) }
      });
      return NextResponse.json({ success: true, value: config.value_ptBR });
   } catch (error: any) {
      console.error('Config API error:', error);
      return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 });
   }
}
