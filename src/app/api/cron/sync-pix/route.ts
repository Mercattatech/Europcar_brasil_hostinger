import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendTransactionalEmail } from '@/lib/emailService';

export const dynamic = 'force-dynamic';

function gerarLocalizador() {
   const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
   let result = '';
   for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
   }
   return result;
}

export async function GET(request: Request) {
   try {
      // Find all pending PIX reservations created in the last 24 hours
      // We only check the last 24 hours to avoid polling dead/expired PIXs forever.
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const pendingReservations = await prisma.localReservation.findMany({
         where: { 
            status: 'PENDING_PIX',
            createdAt: { gte: yesterday }
         }
      });

      if (pendingReservations.length === 0) {
         return NextResponse.json({ message: "Nenhuma reserva PIX pendente nas últimas 24h." });
      }

      const cieloConfig = await prisma.cieloConfig.findFirst();
      if (!cieloConfig) return NextResponse.json({ error: 'Configuração Cielo não encontrada' }, { status: 500 });

      const results = [];

      for (const reserva of pendingReservations) {
         try {
            const parsedData: any = JSON.parse(reserva.customerData as string);
            const paymentId = parsedData?.paymentId;

            if (!paymentId) {
               results.push({ id: reserva.id, status: 'error', reason: 'Sem paymentId' });
               continue;
            }

            const CIELO_API_URL = cieloConfig.isSandbox 
               ? `https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales/${paymentId}`
               : `https://apiquery.cieloecommerce.cielo.com.br/1/sales/${paymentId}`;
            
            const resCielo = await fetch(CIELO_API_URL, {
               headers: {
                  "MerchantId": cieloConfig.merchantId,
                  "MerchantKey": cieloConfig.merchantKey
               }
            });

            if (!resCielo.ok) {
               results.push({ id: reserva.id, status: 'error', reason: 'Cielo API request failed' });
               continue;
            }

            const cieloJson = await resCielo.json();
            
            // Status 2 = Paid, Status 1 = Authorized (for Pix usually meaning paid or authorized to be captured)
            if (cieloJson.Payment && (cieloJson.Payment.Status === 2 || cieloJson.Payment.Status === 1)) {
               const resNumber = gerarLocalizador();
               
               await prisma.localReservation.update({
                  where: { id: reserva.id },
                  data: {
                     resNumber,
                     status: 'CONFIRMED_PREPAID'
                  }
               });

               // Disparar Email
               if (parsedData?.email) {
                  try {
                     await sendTransactionalEmail(parsedData.email, 'RESERVA_SUCESSO', {
                        NOME: parsedData.nome || '',
                        NUMERO_RESERVA: resNumber,
                        VALOR: String(cieloJson.Payment.Amount / 100) || '',
                        DATA_RETIRADA: parsedData.booking?.pickupDate || '',
                        CARRO: parsedData.booking?.car?.carCategoryName || parsedData.booking?.car?.name || ''
                     });
                  } catch (e) {
                     console.error("Erro ao enviar email PIX Sincronizado:", e);
                  }
               }

               results.push({ id: reserva.id, orderId: reserva.merchantOrderId, status: 'PAID' });
            } else {
               results.push({ id: reserva.id, orderId: reserva.merchantOrderId, status: 'PENDING' });
            }
         } catch (error) {
            results.push({ id: reserva.id, status: 'error', reason: String(error) });
         }
      }

      return NextResponse.json({ 
         message: `Verificadas ${pendingReservations.length} reservas`, 
         results 
      });

   } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
   }
}
