import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = ["grupomercatta@gmail.com", "matheus@grupomercatta.com.br", "matheusconti@gmail.com", "matheus@grupomercatta.com"];

async function checkAdmin() {
   const session = await getServerSession(authOptions);
   if (!session?.user?.email) return false;
   if (ADMIN_EMAILS.includes(session.user.email)) return true;
   const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
   return dbUser?.role === 'ADMIN';
}

export async function GET(req: Request) {
   if (!(await checkAdmin())) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }

   try {
      const { searchParams } = new URL(req.url);
      const statusFilter = searchParams.get('status');
      const opStatusFilter = searchParams.get('operationalStatus');
      const search = searchParams.get('search');
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      // Se tem busca de texto, usar raw query para ILIKE no JSON (case-insensitive)
      if (search) {
         const conditions: string[] = [];
         const params: any[] = [];
         let paramIndex = 1;

         // Busca no resNumber
         conditions.push(`"resNumber" ILIKE $${paramIndex}`);
         params.push(`%${search}%`);
         paramIndex++;

         // Busca no merchantOrderId
         conditions.push(`"merchantOrderId" ILIKE $${paramIndex}`);
         params.push(`%${search}%`);
         paramIndex++;

         // Busca dentro do JSON customerData (cast para texto para ILIKE)
         conditions.push(`CAST("customerData" AS TEXT) ILIKE $${paramIndex}`);
         params.push(`%${search}%`);
         paramIndex++;

         let sql = `SELECT * FROM "LocalReservation" WHERE (${conditions.join(' OR ')})`;

         // Filtro por status
         if (statusFilter && statusFilter !== 'ALL') {
            sql += ` AND "status" = $${paramIndex}`;
            params.push(statusFilter);
            paramIndex++;
         }

         // Filtro por status operacional
         if (opStatusFilter && opStatusFilter !== 'ALL') {
            sql += ` AND "operationalStatus" = $${paramIndex}`;
            params.push(opStatusFilter);
            paramIndex++;
         }

         // Filtro por data
         if (startDate) {
            sql += ` AND "createdAt" >= $${paramIndex}`;
            params.push(new Date(startDate));
            paramIndex++;
         }
         if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            sql += ` AND "createdAt" <= $${paramIndex}`;
            params.push(end);
            paramIndex++;
         }

         sql += ` ORDER BY "createdAt" DESC`;

         const rawReservations: any[] = await prisma.$queryRawUnsafe(sql, ...params);
         // Raw queries retornam BigInt para Int — converter para Number para serialização JSON
         const reservations = rawReservations.map((r: any) => ({
            ...r,
            amountInCents: r.amountInCents ? Number(r.amountInCents) : null,
         }));
         return NextResponse.json(reservations);
      }

      // Sem busca de texto — usar Prisma padrão
      const where: any = {};

      if (statusFilter && statusFilter !== 'ALL') {
         where.status = statusFilter;
      }

      if (opStatusFilter && opStatusFilter !== 'ALL') {
         where.operationalStatus = opStatusFilter;
      }

      if (startDate || endDate) {
         where.createdAt = {};
         if (startDate) {
            where.createdAt.gte = new Date(startDate);
         }
         if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            where.createdAt.lte = end;
         }
      }

      const reservations = await prisma.localReservation.findMany({
         where,
         orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json(reservations);
   } catch (error: any) {
      console.error('Error fetching reservations:', error);
      return NextResponse.json({ error: 'Erro ao buscar reservas' }, { status: 500 });
   }
}
