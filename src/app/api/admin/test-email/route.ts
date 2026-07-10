import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { sendTestEmail } from '@/lib/emailService';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com", "admin@mercatta.com.br"];

async function checkAdmin() {
   const session = await getServerSession(authOptions);
   if (!session?.user?.email) return false;
   if (ADMIN_EMAILS.includes(session.user.email)) return true;
   const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
   return dbUser?.role === 'ADMIN';
}

export async function POST(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { to } = await request.json();

    if (!to || !to.includes('@')) {
      return NextResponse.json({ error: 'E-mail de destino inválido.' }, { status: 400 });
    }

    const result = await sendTestEmail(to);

    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: `E-mail de teste enviado com sucesso via ${result.provider || 'provedor configurado'}.`,
        provider: result.provider
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: result.error || 'Erro desconhecido ao enviar e-mail de teste.'
    }, { status: 500 });

  } catch (error: any) {
    console.error('[test-email] Erro:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
