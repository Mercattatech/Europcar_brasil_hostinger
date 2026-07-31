import { callXRS } from '@/lib/europcar/xrsClient';
import prisma from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/emailService';
import { voidCieloPayment } from '@/lib/cielo/cieloClient';

export async function cancelXRSReservation(resNumber: string) {
  const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="cancelReservation">
    <serviceParameters>
      <reservation resNumber="${resNumber}"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

  const config = {
    callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
    password: process.env.XRS_PASSWORD || 'DEMO',
    action: 'cancelReservation',
    sourceFile: 'cancelService.ts'
  };

  const xrsResponse = await callXRS(xmlRequest, config);

  const returnCode =
    xrsResponse?.message?.serviceResponse?.$?.returnCode ||
    xrsResponse?.message?.serviceResponse?.returnCode ||
    null;

  const hasError = returnCode && returnCode !== 'OK';

  let errorMsg = 'Erro desconhecido na Europcar';
  if (hasError) {
    const errors = xrsResponse?.message?.serviceResponse?.errors?.error || xrsResponse?.serviceResponse?.errors?.error;
    if (Array.isArray(errors)) {
      errorMsg = errors.map((e: any) => e.errorText || e.$?.errorText || '').join(' | ');
    } else if (errors) {
      errorMsg = errors.errorText || errors.$?.errorText || errorMsg;
    }
    
    if (errorMsg === 'Erro desconhecido na Europcar' || !errorMsg.trim()) {
      try {
        const rawErr = xrsResponse?.message?.serviceResponse?.errors || xrsResponse?.serviceResponse?.errors || xrsResponse;
        errorMsg = `Erro XRS (KO): ${JSON.stringify(rawErr).slice(0, 150)}`;
      } catch(e) {
        errorMsg = "Erro desconhecido na Europcar (XRS KO)";
      }
    }
  }

  return { hasError, returnCode, errorMsg, raw: xrsResponse };
}

/**
 * Estorna na Cielo o pagamento associado a uma reserva local cancelada (Cartão ou Pix
 * já confirmado — ambos usam o mesmo endpoint de void da API 3.0). Não bloqueia o
 * cancelamento no XRS/GreenWay se falhar: só loga, já que o cancelamento da reserva em
 * si é mais crítico que o estorno (que pode ser feito manualmente no portal Cielo).
 */
export async function voidCieloPaymentForLocalReservation(localReservationId: string): Promise<{ attempted: boolean; success?: boolean; message?: string }> {
  try {
    const reservation = await prisma.localReservation.findUnique({ where: { id: localReservationId } });
    if (!reservation?.customerData) return { attempted: false };

    const parsed: any = JSON.parse(reservation.customerData as string);
    const paymentId: string | undefined = parsed?.paymentId;
    if (!paymentId) return { attempted: false };

    const cieloConfig = await prisma.cieloConfig.findFirst();
    if (!cieloConfig?.merchantId || !cieloConfig?.merchantKey) {
      console.warn('[cancelService] Sem credenciais Cielo configuradas — não foi possível estornar', paymentId);
      return { attempted: false };
    }

    const result = await voidCieloPayment(paymentId, cieloConfig.merchantId, cieloConfig.merchantKey, cieloConfig.isSandbox === true);
    console.log(`[cancelService] Estorno Cielo ${paymentId}:`, result.success ? 'OK' : `FALHOU (${result.message})`);
    return { attempted: true, success: result.success, message: result.message };
  } catch (err: any) {
    console.error('[cancelService] Erro ao estornar pagamento Cielo:', err.message);
    return { attempted: true, success: false, message: err.message };
  }
}
