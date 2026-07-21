import { callXRS } from '@/lib/europcar/xrsClient';
import prisma from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/emailService';

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
