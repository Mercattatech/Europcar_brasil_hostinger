import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import prisma from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/emailService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { resNumber } = body;

    if (!resNumber) {
      return NextResponse.json({ error: 'resNumber é obrigatório para cancelamento' }, { status: 400 });
    }

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
      sourceFile: 'cancelReservation/route.ts'
    };

    const xrsResponse = await callXRS(xmlRequest, config);

    // Check for XRS-level errors in the response
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
      
      // If we still don't have a good error message, serialize the response for debugging
      if (errorMsg === 'Erro desconhecido na Europcar' || !errorMsg.trim()) {
        try {
          const rawErr = xrsResponse?.message?.serviceResponse?.errors || xrsResponse?.serviceResponse?.errors || xrsResponse;
          errorMsg = `Erro XRS (KO): ${JSON.stringify(rawErr).slice(0, 150)}`;
        } catch(e) {
          errorMsg = "Erro desconhecido na Europcar (XRS KO)";
        }
      }

      // Se a Europcar já tiver cancelado previamente, a string de erro costuma ter "cancel" ou "already"
      const isAlreadyCancelled = errorMsg.toLowerCase().includes('cancel') || errorMsg.toLowerCase().includes('already');
      if (isAlreadyCancelled) {
        try {
          const localRes = await prisma.localReservation.update({
            where: { resNumber },
            data: { status: 'CANCELLED' }
          });
          
          if (localRes?.customerData) {
             const cd: any = localRes.customerData;
             if (cd.email) {
                await sendTransactionalEmail(cd.email, 'CANCELAMENTO', {
                   NOME: cd.nome || '',
                   SOBRENOME: cd.sobrenome || '',
                   NUMERO_RESERVA: resNumber
                });
             }
          }
        } catch (dbErr) {}
        
        return NextResponse.json({
          success: true,
          returnCode,
          error: "Reserva já estava cancelada na Europcar.",
          raw: xrsResponse
        });
      }

      return NextResponse.json({
        success: false,
        returnCode,
        error: errorMsg,
        raw: xrsResponse
      }, { status: 400 });
    }

    // Se cancelou com sucesso na Europcar, atualiza o status local para CANCELLED
    if (!hasError) {
      try {
        const localRes = await prisma.localReservation.update({
          where: { resNumber },
          data: { status: 'CANCELLED' }
        });
        
        // Trigger Email
        if (localRes?.customerData) {
           const cd: any = localRes.customerData;
           if (cd.email) {
              await sendTransactionalEmail(cd.email, 'CANCELAMENTO', {
                 NOME: cd.nome || '',
                 SOBRENOME: cd.sobrenome || '',
                 NUMERO_RESERVA: resNumber
              });
           }
        }
      } catch (dbErr) {
        console.error("Erro ao atualizar status local para CANCELLED:", dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      returnCode,
      raw: xrsResponse
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao cancelar reserva no XRS' },
      { status: 500 }
    );
  }
}
