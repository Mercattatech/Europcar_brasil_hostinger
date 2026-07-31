import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];
const PREFIX = 'reservation.error.';

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  if (ADMIN_EMAILS.includes(session.user.email)) return true;
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  return dbUser?.role === 'ADMIN';
}

// GET — lista todas as mensagens reservation.error.<code> cadastradas no CMS
export async function GET() {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const blocks = await prisma.contentBlock.findMany({
    where: { key: { startsWith: PREFIX } },
    orderBy: { key: 'asc' },
  });
  return NextResponse.json(blocks.map(b => ({ code: b.key.slice(PREFIX.length), message: b.value_ptBR })));
}

// POST — cria/atualiza a mensagem amigável de um código (Cielo ReturnCode, XRS errorCode, etc.)
export async function POST(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { code, message } = await req.json();
  if (!code || !message) {
    return NextResponse.json({ error: 'code e message são obrigatórios' }, { status: 400 });
  }
  const key = `${PREFIX}${String(code).trim()}`;
  const block = await prisma.contentBlock.upsert({
    where: { key },
    update: { value_ptBR: message },
    create: { key, value_ptBR: message },
  });
  return NextResponse.json({ code: block.key.slice(PREFIX.length), message: block.value_ptBR });
}

// DELETE — remove a mensagem de um código (volta a usar o fallback técnico do backend)
export async function DELETE(req: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if (!code) {
    return NextResponse.json({ error: 'code é obrigatório' }, { status: 400 });
  }
  await prisma.contentBlock.delete({ where: { key: `${PREFIX}${code}` } }).catch(() => {});
  return NextResponse.json({ success: true });
}
