import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// ENDPOINT TEMPORÁRIO — usado para debug, remover depois
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
   const { searchParams } = new URL(req.url);
   const q = searchParams.get('q') || 'rosimeir';

   try {
      // 1. Buscar nos logs XRS
      const xrsLogs: any[] = await prisma.$queryRawUnsafe(
         `SELECT id, action, "sourceFile", "hasError", "createdAt",
                 SUBSTRING("xmlRequest", 1, 500) as "xmlRequestPreview",
                 SUBSTRING("xmlResponse", 1, 500) as "xmlResponsePreview"
          FROM "LogXRS"
          WHERE CAST("xmlRequest" AS TEXT) ILIKE $1
             OR CAST("xmlResponse" AS TEXT) ILIKE $1
          ORDER BY "createdAt" DESC
          LIMIT 20`,
         `%${q}%`
      );

      // 2. Buscar nos logs Cielo
      const cieloLogs: any[] = await prisma.$queryRawUnsafe(
         `SELECT id, endpoint, "createdAt",
                 SUBSTRING(payload, 1, 500) as "payloadPreview",
                 SUBSTRING(response, 1, 500) as "responsePreview"
          FROM "LogCielo"
          WHERE CAST(payload AS TEXT) ILIKE $1
             OR CAST(response AS TEXT) ILIKE $1
          ORDER BY "createdAt" DESC
          LIMIT 20`,
         `%${q}%`
      );

      // 3. Buscar nas reservas locais
      const reservations: any[] = await prisma.$queryRawUnsafe(
         `SELECT id, "resNumber", "merchantOrderId", status, "amountInCents", "createdAt",
                 SUBSTRING(CAST("customerData" AS TEXT), 1, 1000) as "customerDataPreview"
          FROM "LocalReservation"
          WHERE CAST("customerData" AS TEXT) ILIKE $1
          ORDER BY "createdAt" DESC
          LIMIT 20`,
         `%${q}%`
      );

      // 4. Buscar no User
      const users = await prisma.user.findMany({
         where: {
            OR: [
               { email: { contains: q, mode: 'insensitive' } },
               { name: { contains: q, mode: 'insensitive' } },
            ]
         },
         select: { id: true, name: true, email: true, role: true, status: true, createdAt: true }
      });

      return NextResponse.json({
         query: q,
         xrsLogs: { count: xrsLogs.length, entries: xrsLogs },
         cieloLogs: { count: cieloLogs.length, entries: cieloLogs },
         reservations: { count: reservations.length, entries: reservations },
         users: { count: users.length, entries: users },
      });
   } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
   }
}
