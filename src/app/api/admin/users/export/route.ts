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
      // 1. Fetch all users
      const users = await prisma.user.findMany({
         orderBy: { createdAt: 'desc' }
      });

      // 2. Fetch all reservations
      const reservations = await prisma.localReservation.findMany({
         orderBy: { createdAt: 'desc' }
      });

      // Map reservations by email
      const reservationsByEmail: Record<string, any[]> = {};
      
      for (const res of reservations) {
         try {
            const data = typeof res.customerData === 'string' ? JSON.parse(res.customerData) : res.customerData;
            const email = (data?.customer?.email || data?.driver?.email || '').toLowerCase().trim();
            if (email) {
               if (!reservationsByEmail[email]) reservationsByEmail[email] = [];
               reservationsByEmail[email].push(res);
            }
         } catch (e) {
            // ignore parse errors for individual reservations
         }
      }

      // 3. Build CSV
      const headers = [
         'Nome',
         'Email',
         'Telefone',
         'Status do Usuário',
         'Papel',
         'Data de Cadastro',
         'Reserva ID',
         'Veículo',
         'Data Retirada',
         'Valor (R$)',
         'Status Reserva',
         'Data Reserva'
      ];

      const rows: string[][] = [];

      const STATUS_LABELS: Record<string, string> = {
         CONFIRMED_PREPAID: 'Pago Online',
         CONFIRMED_NON_PREPAID: 'Pagar Balcão',
         PENDING_PIX: 'PIX Aguardando',
         CANCELLED: 'Cancelada',
         ON_REQUEST: 'Sob Consulta'
      };

      for (const user of users) {
         const userEmail = (user.email || '').toLowerCase().trim();
         const userReservations = userEmail ? (reservationsByEmail[userEmail] || []) : [];

         const baseRow = [
            user.name || '',
            user.email || '',
            user.phone || '',
            user.status === 'ACTIVE' ? 'Ativo' : 'Bloqueado',
            user.role || 'USER',
            user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : ''
         ];

         if (userReservations.length === 0) {
            rows.push([...baseRow, '', '', '', '', '', '']);
         } else {
            for (const res of userReservations) {
               let carName = '';
               let pickupDate = '';
               try {
                  const data = typeof res.customerData === 'string' ? JSON.parse(res.customerData) : res.customerData;
                  carName = data?.booking?.car?.carCategoryName || data?.booking?.car?.name || data?.booking?.car?.carCategoryCode || '';
                  const rawDate = data?.booking?.pickupDate || data?.booking?.pickupdate || '';
                  if (rawDate && rawDate.length >= 8) {
                     pickupDate = `${rawDate.slice(6,8)}/${rawDate.slice(4,6)}/${rawDate.slice(0,4)}`;
                  }
               } catch (e) {}

               const amount = res.amountInCents ? (res.amountInCents / 100).toFixed(2).replace('.', ',') : '';
               const status = STATUS_LABELS[res.status] || res.status;
               const resDate = res.createdAt ? new Date(res.createdAt).toLocaleDateString('pt-BR') : '';

               rows.push([
                  ...baseRow,
                  res.resNumber || '',
                  carName,
                  pickupDate,
                  amount,
                  status,
                  resDate
               ]);
            }
         }
      }

      // Add BOM for Excel UTF-8 encoding support
      const BOM = '\uFEFF';
      
      const escapeCsv = (str: string) => {
         const escaped = String(str).replace(/"/g, '""');
         return `"${escaped}"`;
      };

      const csvContent = BOM + [
         headers.map(escapeCsv).join(';'),
         ...rows.map(row => row.map(escapeCsv).join(';'))
      ].join('\n');

      // Return as file download
      return new NextResponse(csvContent, {
         status: 200,
         headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="usuarios_reservas_${new Date().toISOString().split('T')[0]}.csv"`
         }
      });

   } catch (error: any) {
      console.error('Error exporting users:', error);
      return NextResponse.json({ error: 'Erro ao exportar usuários' }, { status: 500 });
   }
}
