import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { sendTestEmail, sendTransactionalEmail } from '@/lib/emailService';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com", "admin@mercatta.com.br"];

async function checkAdmin() {
   const session = await getServerSession(authOptions);
   if (!session?.user?.email) return false;
   if (ADMIN_EMAILS.includes(session.user.email)) return true;
   const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
   return dbUser?.role === 'ADMIN';
}

/** Sample data for preview tests — realistic values for each variable */
const SAMPLE_DATA: Record<string, string> = {
  NOME: 'Carlos',
  SOBRENOME: 'Oliveira',
  EMAIL: 'carlos.oliveira@email.com.br',
  TELEFONE: '+55 (11) 99876-5432',
  CPF: '123.456.789-00',
  NUMERO_RESERVA: 'BR2026-78345',
  VALOR: '1.280,00',
  VALOR_TOTAL: '1.280,00',
  FORMA_PAGAMENTO: 'Cartão de Crédito',
  CARRO: 'Volkswagen T-Cross ou Similar',
  CATEGORIA_CARRO: 'FFAR',
  DATA_RETIRADA: '15/08/2026',
  HORARIO_RETIRADA: '10:00',
  LOCAL_RETIRADA: 'GRU01 — Aeroporto de Guarulhos',
  DATA_DEVOLUCAO: '20/08/2026',
  HORARIO_DEVOLUCAO: '10:00',
  LOCAL_DEVOLUCAO: 'GRU01 — Aeroporto de Guarulhos',
  LISTA_PROTECOES: '• Proteção Colisão e Roubo (CDW) (R$ 98,00)\n• Assistência 24h (RSA) (R$ 32,00)',
  LISTA_EXTRAS: '• Cadeirinha infantil x1\n• GPS x1',
  LINK_RESET: 'https://www.europcar.com.br/reset-senha?token=exemplo-abc123',
  PIX_COPIA_COLA: '00020101021126580014br.gov.bcb.pix0136exemplo-chave-pix-aqui5204000053039865802BR5925Europcar Brasil6009SAO PAULO62070503***63046CA3',
  ERRO: 'Cartão recusado pela operadora. Por favor, verifique os dados e tente novamente.',
};

export async function POST(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { to, trigger, useTemplate } = await request.json();

    if (!to || !to.includes('@')) {
      return NextResponse.json({ error: 'E-mail de destino inválido.' }, { status: 400 });
    }

    // ── Mode 1: Preview template with sample data ─────────────────────────────
    if (useTemplate && trigger) {
      const result = await sendTransactionalEmail(to, trigger, SAMPLE_DATA);

      if (result.success) {
        const provider = (result as any).provider;
        return NextResponse.json({
          success: true,
          message: `Preview do template "${trigger}" enviado com sucesso via ${provider || 'provedor configurado'}.`,
          provider,
        });
      }

      return NextResponse.json({
        success: false,
        error: result.error || `Erro ao enviar preview do template "${trigger}". Verifique se o gatilho está mapeado para um template.`,
      }, { status: 500 });
    }

    // ── Mode 2: Generic test email (original behavior) ────────────────────────
    const result = await sendTestEmail(to);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `E-mail de teste enviado com sucesso via ${result.provider || 'provedor configurado'}.`,
        provider: result.provider,
      });
    }

    return NextResponse.json({
      success: false,
      error: result.error || 'Erro desconhecido ao enviar e-mail de teste.',
    }, { status: 500 });

  } catch (error: any) {
    console.error('[test-email] Erro:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
