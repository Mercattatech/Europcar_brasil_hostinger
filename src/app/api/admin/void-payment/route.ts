import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import prisma from '@/lib/prisma';
import { voidCieloPayment } from '@/lib/cielo/cieloClient';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = [
  'grupomercatta@gmail.com',
  'matheus@grupomercatta.com.br',
  'matheusconti@gmail.com',
  'matheus@grupomercatta.com',
];

async function checkAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  if (ADMIN_EMAILS.includes(session.user.email)) return true;
  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  return dbUser?.role === 'ADMIN';
}

/** POST /api/admin/void-payment
 * Body: { paymentId: string }
 * Estorna manualmente um pagamento Cielo pelo PaymentId.
 */
export async function POST(request: Request) {
  if (!(await checkAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { paymentId } = await request.json();
    if (!paymentId || typeof paymentId !== 'string') {
      return NextResponse.json({ error: 'paymentId é obrigatório' }, { status: 400 });
    }

    // Load Cielo credentials from DB
    let cieloConfig: any = null;
    try {
      cieloConfig = await prisma.cieloConfig.findFirst();
    } catch {
      const rows = await prisma.$queryRaw<any[]>`SELECT "merchantId","merchantKey","isSandbox" FROM "CieloConfig" LIMIT 1`;
      if (rows.length > 0) cieloConfig = rows[0];
    }

    if (!cieloConfig?.merchantId || !cieloConfig?.merchantKey) {
      return NextResponse.json({ error: 'Credenciais Cielo não configuradas' }, { status: 500 });
    }

    const isSandbox = cieloConfig.isSandbox === true;

    console.log(`[admin/void-payment] Estornando PaymentId: ${paymentId} | Sandbox: ${isSandbox}`);

    const result = await voidCieloPayment(
      paymentId.trim(),
      cieloConfig.merchantId,
      cieloConfig.merchantKey,
      isSandbox
    );

    if (result.voided) {
      console.log(`[admin/void-payment] ✅ Estorno bem-sucedido: ${paymentId}`);
      return NextResponse.json({ success: true, message: `Pagamento ${paymentId} estornado com sucesso.` });
    } else {
      console.error(`[admin/void-payment] ❌ Estorno falhou: ${result.message}`);
      return NextResponse.json({ error: `Estorno falhou: ${result.message}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error('[admin/void-payment] Exceção:', err.message);
    return NextResponse.json({ error: 'Erro interno: ' + err.message }, { status: 500 });
  }
}
