import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com", "admin@mercatta.com.br"];

async function checkAdmin() {
   const session = await getServerSession(authOptions);
   if (!session?.user?.email) return false;
   if (ADMIN_EMAILS.includes(session.user.email)) return true;
   const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
   return dbUser?.role === 'ADMIN';
}

export async function GET() {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const templatesBlock = await prisma.contentBlock.findUnique({ where: { key: 'EMAIL_TEMPLATES' } });
    const triggersBlock = await prisma.contentBlock.findUnique({ where: { key: 'EMAIL_TRIGGERS' } });
    
    const templates = templatesBlock?.value_ptBR ? JSON.parse(templatesBlock.value_ptBR) : [];
    const triggers = triggersBlock?.value_ptBR ? JSON.parse(triggersBlock.value_ptBR) : {};

    return NextResponse.json({ templates, triggers });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar templates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await checkAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const { templates, triggers } = body;

    if (templates) {
      await prisma.contentBlock.upsert({
        where: { key: 'EMAIL_TEMPLATES' },
        update: { value_ptBR: JSON.stringify(templates) },
        create: { key: 'EMAIL_TEMPLATES', value_ptBR: JSON.stringify(templates) }
      });
    }

    if (triggers) {
      await prisma.contentBlock.upsert({
        where: { key: 'EMAIL_TRIGGERS' },
        update: { value_ptBR: JSON.stringify(triggers) },
        create: { key: 'EMAIL_TRIGGERS', value_ptBR: JSON.stringify(triggers) }
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao salvar configurações' }, { status: 500 });
  }
}
