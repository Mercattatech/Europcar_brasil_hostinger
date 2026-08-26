import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
   try {
      const { email, resNumber } = await req.json();

      if (!email || !resNumber) {
         return NextResponse.json({ error: 'Email e Número da Reserva são obrigatórios' }, { status: 400 });
      }

      const reservation = await prisma.localReservation.findUnique({
         where: { resNumber }
      });

      if (!reservation) {
         return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
      }

      // Validar Email
      const customerData = JSON.parse(reservation.customerData as string);
      if (customerData?.email?.toLowerCase() !== email.toLowerCase()) {
         return NextResponse.json({ error: 'Email não corresponde à reserva' }, { status: 403 });
      }

      return NextResponse.json({
         resNumber: reservation.resNumber,
         status: reservation.status,
         createdAt: reservation.createdAt,
         customer: customerData,
         pickupDate: customerData?.booking?.pickupDate,
         returnDate: customerData?.booking?.returnDate,
         car: customerData?.booking?.car?.name,
         total: customerData?.booking?.totalDay
      });

   } catch (error) {
      return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
   }
}
