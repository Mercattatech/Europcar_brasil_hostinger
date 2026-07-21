import { NextResponse } from 'next/server';
import { cancelXRSReservation } from '@/lib/europcar/cancelService';
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

    const { hasError, returnCode, errorMsg, raw: xrsResponse } = await cancelXRSReservation(resNumber);

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
