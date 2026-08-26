import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const MARGIN_KEY = 'eto_margin_percent';
const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com", "admin@mercatta.com.br"];

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  if (ADMIN_EMAILS.includes(session.user.email)) return true;
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  return dbUser?.role === 'ADMIN';
}

// GET — público (frontend precisa ler a margem para exibir preços)
export async function GET() {
  try {
    const config = await prisma.contentBlock.findUnique({ where: { key: MARGIN_KEY } });
    const percent = parseFloat(config?.value_ptBR || '0');
    return NextResponse.json({ percent: isNaN(percent) ? 0 : percent });
  } catch (error: any) {
    // DB down — default to 0% margin
    console.warn('[margin] DB error, usando margem 0%:', error.message);
    return NextResponse.json({ percent: 0 });
  }
}

// POST — admin only
export async function POST(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { percent } = await request.json();
    const value = Math.max(0, Math.min(100, parseFloat(percent) || 0));

    await prisma.contentBlock.upsert({
      where: { key: MARGIN_KEY },
      update: { value_ptBR: String(value) },
      create: { key: MARGIN_KEY, value_ptBR: String(value) },
    });

    return NextResponse.json({ success: true, percent: value });
  } catch (error: any) {
    console.error('[margin] Error:', error);
    return NextResponse.json({ error: 'Erro ao salvar margem' }, { status: 500 });
  }
}
