import { NextResponse } from 'next/server';
import { checkAdmin as assertAdmin } from '@/lib/checkAdmin';
import prisma from '@/lib/prisma';

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
