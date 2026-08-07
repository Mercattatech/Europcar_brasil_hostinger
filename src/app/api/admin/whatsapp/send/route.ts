import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { sendWhatsappTrigger, WaTrigger } from '@/lib/whatsapp/whatsappService';
import { GmLeadClient } from '@/lib/whatsapp/gmLeadClient';
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
 * POST /api/admin/whatsapp/send
 *
 * Disparo manual de WhatsApp via painel.
 * Body:
 *   { action: 'test', number: string, message: string }
 *     → Envia texto simples para um número específico (teste de conexão)
 *
 *   { action: 'trigger', trigger: WaTrigger, clientPhone?: string, vars?: object }
 *     → Dispara o gatilho configurado (ex: RESERVA_SUCESSO) para todos os números
 */
export async function POST(request: Request) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    // ── Teste de conexão simples ─────────────────────────────────
    if (action === 'test') {
      const { number, message } = body as { number: string; message?: string };
      if (!number) return NextResponse.json({ error: 'number é obrigatório' }, { status: 400 });

      const tokenBlock = await prisma.contentBlock.findUnique({ where: { key: 'WA_TOKEN' } });
      const token = tokenBlock?.value_ptBR;
      if (!token) return NextResponse.json({ error: 'WA_TOKEN não configurado' }, { status: 400 });

      const gm = new GmLeadClient({ token });
      const result = await gm.testConnection(number);
      if (!result.ok) throw new Error(result.message);

      return NextResponse.json({ ok: true, message: result.message });
    }

    // ── Disparo por gatilho ────────────────────────────────────
    if (action === 'trigger') {
      const { trigger, clientPhone, vars } = body as {
        trigger: WaTrigger;
        clientPhone?: string;
        vars?: Record<string, string>;
      };

      if (!trigger) return NextResponse.json({ error: 'trigger é obrigatório' }, { status: 400 });

      // Fire-and-forget (não espera — o painel recebe resposta rápida)
      sendWhatsappTrigger(trigger, vars || {}, clientPhone).catch(console.error);

      return NextResponse.json({ ok: true, message: `Disparo "${trigger}" iniciado em background.` });
    }

    return NextResponse.json({ error: 'action inválida. Use: test | trigger' }, { status: 400 });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno' }, { status: 500 });
  }
}
