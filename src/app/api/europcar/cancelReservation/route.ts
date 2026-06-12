import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
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

    // Se cancelou com sucesso na Europcar, atualiza o status local para CANCELLED
    if (!hasError) {
      try {
        await prisma.localReservation.update({
          where: { resNumber },
          data: { status: 'CANCELLED' }
        });
      } catch (dbErr) {
        console.error("Erro ao atualizar status local para CANCELLED:", dbErr);
        // Não falha o retorno pois na Europcar já foi cancelado
      }
    }

    return NextResponse.json({
      success: !hasError,
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
