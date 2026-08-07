import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';

const ADMIN_EMAILS = [
  'grupomercatta@gmail.com',
  'matheus@grupomercatta.com.br',
  'matheusconti@gmail.com',
  'matheus@grupomercatta.com',
  'admin@mercatta.com.br',
];

async function assertAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  if (ADMIN_EMAILS.includes(session.user.email)) return true;
  if ((session.user as any).role === 'ADMIN') return true;
  return false;
}

/**
 * GET /api/admin/whatsapp?key=TOKEN
 * Lê uma configuração WhatsApp (ContentBlock com prefixo WA_)
 */
export async function GET(request: Request) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get('key');
  if (!key) return NextResponse.json({ error: 'key é obrigatório' }, { status: 400 });

  try {
    const block = await prisma.contentBlock.findUnique({
      where: { key: `WA_${key}` },
    });
    return NextResponse.json({ value: block?.value_ptBR || null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/whatsapp
 * Body: { key: string, value: string }
 * Salva uma configuração WhatsApp
 */
export async function POST(request: Request) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const { key, value } = await request.json();
    if (!key) return NextResponse.json({ error: 'key é obrigatório' }, { status: 400 });

    await prisma.contentBlock.upsert({
      where: { key: `WA_${key}` },
      update: { value_ptBR: value ?? '' },
      create: { key: `WA_${key}`, value_ptBR: value ?? '' },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
