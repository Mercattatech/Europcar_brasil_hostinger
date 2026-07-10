import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import prisma from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/emailService';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { resNumber, pickupStationID, pickupDate, pickupTime, firstName, lastName } = body;

    if (!resNumber) {
      return NextResponse.json({ error: 'resNumber é obrigatório para modificação' }, { status: 400 });
    }

    // Per Antonio: only send the field being modified + driver name
    const checkoutBlock = (pickupStationID && pickupDate && pickupTime)
      ? `\n      <checkout stationID="${pickupStationID}" date="${pickupDate}" time="${pickupTime}"/>`
      : '';

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="modifyReservation">
    <serviceParameters>
      <reservation resNumber="${resNumber}">${checkoutBlock}
      </reservation>
      <driver countryOfResidence="BR" firstName="${firstName || 'Passageiro'}" lastName="${lastName || 'Europcar'}" title="MR"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
      password: process.env.XRS_PASSWORD || 'DEMO',
      action: 'modifyReservation',
      sourceFile: 'modifyReservation/route.ts'
    };

    const xrsResponse = await callXRS(xmlRequest, config);

    const returnCode =
      xrsResponse?.message?.serviceResponse?.$?.returnCode ||
      xrsResponse?.message?.serviceResponse?.returnCode ||
      null;

    let errorMsg = 'Erro desconhecido na Europcar';
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

    const hasError = returnCode && returnCode !== 'OK';

    // Send email on successful modification
    if (!hasError) {
      try {
        const localRes = await prisma.localReservation.findFirst({
          where: { resNumber }
        });

        if (localRes?.customerData) {
          const cd: any = typeof localRes.customerData === 'string'
            ? JSON.parse(localRes.customerData)
            : localRes.customerData;

          if (cd.email) {
            await sendTransactionalEmail(cd.email, 'RESERVA_ALTERADA', {
              NOME: cd.nome || cd.firstName || '',
              SOBRENOME: cd.sobrenome || cd.lastName || '',
              NUMERO_RESERVA: resNumber,
              DATA_RETIRADA: pickupDate || ''
            });
          }
        }
      } catch (emailErr: any) {
        console.error(`[modifyReservation] Erro ao enviar e-mail de alteração para ${resNumber}:`, emailErr.message);
      }
    }

    return NextResponse.json({
      success: !hasError,
      returnCode,
      error: hasError ? errorMsg : undefined,
      raw: xrsResponse
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao modificar reserva no XRS' },
      { status: 500 }
    );
  }
}
