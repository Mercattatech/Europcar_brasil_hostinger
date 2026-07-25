import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { cancelXRSReservation } from '@/lib/europcar/cancelService';
export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];

async function checkAdmin() {
   const session = await getServerSession(authOptions);
   if (!session?.user?.email) return false;
   if (ADMIN_EMAILS.includes(session.user.email)) return true;
   const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
   return dbUser?.role === 'ADMIN';
}

// PATCH - Update reservation status
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const body = await req.json();
      const updateData: any = {};

      if (body.status !== undefined) updateData.status = body.status;
      if (body.operationalStatus !== undefined) updateData.operationalStatus = body.operationalStatus;

      const updated = await prisma.localReservation.update({
         where: { id: params.id },
         data: updateData,
      });

      return NextResponse.json(updated);
   } catch (error: any) {
      console.error('Error updating reservation:', error);
      return NextResponse.json({ error: 'Erro ao atualizar reserva' }, { status: 500 });
   }
}

// DELETE - Cancel reservation (XRS + local)
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      // 1. Buscar a reserva local para pegar o resNumber
      const reservation = await prisma.localReservation.findUnique({
         where: { id: params.id }
      });

      if (!reservation) {
         return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
      }

      // 2. Se tem resNumber válido (não é local fake), cancelar na Europcar via XRS
      let xrsCancelResult: any = null;
      if (reservation.resNumber && !reservation.resNumber.startsWith('LOCAL_')) {
         try {
            const { hasError, raw, errorMsg } = await cancelXRSReservation(reservation.resNumber);
            xrsCancelResult = { success: !hasError, raw, error: errorMsg };
            console.log(`[CANCEL] XRS cancelamento para ${reservation.resNumber}:`, JSON.stringify(xrsCancelResult));
         } catch (xrsErr: any) {
            // Log mas não bloqueia — o admin pode cancelar manualmente no Greenway
            console.error(`[CANCEL] Falha ao cancelar no XRS (${reservation.resNumber}):`, xrsErr.message);
         }
      }

      // 3. Marcar como CANCELLED localmente (nunca deletar — preservar histórico)
      const updated = await prisma.localReservation.update({
         where: { id: params.id },
         data: { status: 'CANCELLED' }
      });

      return NextResponse.json({
         success: true,
         xrsCancelled: xrsCancelResult?.success || false,
         reservation: updated
      });
   } catch (error: any) {
      console.error('Error cancelling reservation:', error);
      return NextResponse.json({ error: 'Erro ao cancelar reserva' }, { status: 500 });
   }
}
