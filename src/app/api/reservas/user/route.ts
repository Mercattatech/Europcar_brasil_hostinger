import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import prisma from '@/lib/prisma';

// Force dynamic rendering — this route reads session headers and cannot be statically generated
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
   try {
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) {
         return NextResponse.json([], { status: 401 });
      }

      // Busca todas as reservas locais e filtra pelo email dentro do JSON
      // (Bypass temporário para bancos que não suportam JSON field filtering no ORM de forma simples)
      const allReservations = await prisma.localReservation.findMany({
          orderBy: { createdAt: 'desc' }
      });
      
      const userReservations = allReservations.map(r => {
         let cd: any = {};
         try { cd = JSON.parse(r.customerData as string); } catch(e){}
         return {
             id: r.id,
             resNumber: r.resNumber,
             status: r.status,
             createdAt: r.createdAt,
             email: cd?.email,
             pickupDate: cd?.booking?.pickupDate,
             pickupTime: cd?.booking?.pickupTime,
             returnDate: cd?.booking?.returnDate,
             returnTime: cd?.booking?.returnTime,
             pickupStation: cd?.booking?.pickupStation,
             returnStation: cd?.booking?.returnStation,
             car: cd?.booking?.car?.carCategoryName || cd?.booking?.car?.name,
             total: cd?.booking?.car?.totalRateEstimateInBookingCurrency || cd?.booking?.totalDay,
             paymentMethod: cd?.booking?.paymentMethod,
             paymentData: cd?.booking?.paymentData || r.status,
         };
      }).filter(r => r.email?.toLowerCase() === session.user?.email?.toLowerCase());

      return NextResponse.json(userReservations);

   } catch (error) {
      console.error(error);
      return NextResponse.json({ error: 'Erro no servidor' }, { status: 500 });
   }
}
