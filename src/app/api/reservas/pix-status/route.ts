import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { executeXRSBooking } from '@/lib/europcar/bookXRS';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');

  if (!orderId) {
     return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  try {
     const reservaLocal = await prisma.localReservation.findUnique({
         where: { merchantOrderId: orderId }
     });

     if (!reservaLocal) {
         return NextResponse.json({ error: 'Reserva não encontrada' }, { status: 404 });
     }

     if (reservaLocal.status === 'CONFIRMED_PREPAID' && reservaLocal.resNumber) {
         return NextResponse.json({ status: 'PAID', resNumber: reservaLocal.resNumber });
     }

     if (reservaLocal.status === 'PENDING_PIX') {
         // Consulta API da Cielo para ver se pagou
         const cieloConfig = await prisma.cieloConfig.findFirst();
         if (!cieloConfig) return NextResponse.json({ error: 'chaves da cielo falha' }, { status: 500 });
         
         const parsedData: any = JSON.parse(reservaLocal.customerData as string);
         const paymentId = parsedData.paymentId;

         if (paymentId) {
             const CIELO_API_URL = cieloConfig.isSandbox 
                ? `https://apiquerysandbox.cieloecommerce.cielo.com.br/1/sales/${paymentId}`
                : `https://apiquery.cieloecommerce.cielo.com.br/1/sales/${paymentId}`;
             const resCielo = await fetch(CIELO_API_URL, {
                 headers: {
                    "MerchantId": cieloConfig.merchantId,
                    "MerchantKey": cieloConfig.merchantKey
                 }
             });

             const cieloJson = await resCielo.json();
             
             // Status 2 = Paid, Status 12 = Pending, Status 1 = Authorized (for Pix 2 meaning Paid)
             // Let's also consider 1 or 2 as approved/paid depending on sandbox
             if (cieloJson.Payment && (cieloJson.Payment.Status === 2 || cieloJson.Payment.Status === 1)) { 
                 let resNumber = reservaLocal.merchantOrderId;
                 try {
                     const { resNumber: europcarResNumber } = await executeXRSBooking({
                         bookingData: parsedData.booking,
                         customerData: parsedData,
                         paymentData: { method: 'PIX', amountInCents: reservaLocal.amountInCents, merchantOrderId: reservaLocal.merchantOrderId },
                         xrsEquipment: parsedData.booking?.xrsEquipment || [],
                     });
                     if (europcarResNumber) resNumber = europcarResNumber;
                 } catch (e: any) {
                     console.error("PIX-STATUS: Error executing XRS Booking", e.message);
                 }

                 // Atualiza o JSON de customerData para persistir o método de pagamento real
                 // Isso permite que o painel admin exiba "PIX" em vez de apenas o status genérico
                 let updatedCustomerData = parsedData;
                 try {
                   updatedCustomerData = {
                     ...parsedData,
                     paymentMethod: 'PIX',       // método de pagamento confirmado
                     cieloPaymentId: paymentId,  // PaymentId Cielo para rastreabilidade
                   };
                 } catch (_) { /* mantém parsedData original se algo falhar */ }

                 await prisma.localReservation.update({
                     where: { id: reservaLocal.id },
                     data: {
                         resNumber,
                         status: 'CONFIRMED_PREPAID',
                         customerData: JSON.stringify(updatedCustomerData),
                     }
                 });
                 
                 // Trigger Email PIX Sucesso
                 try {
                    if (parsedData?.email) {
                       import('@/lib/emailService').then(({ sendTransactionalEmail }) => {
                          sendTransactionalEmail(parsedData.email, 'RESERVA_SUCESSO', {
                             NOME: parsedData.nome || '',
                             NUMERO_RESERVA: resNumber,
                             VALOR: String(cieloJson.Payment.Amount / 100) || '',
                             DATA_RETIRADA: parsedData.booking?.pickupDate || '',
                             CARRO: parsedData.booking?.car?.carCategoryName || parsedData.booking?.car?.name || ''
                          }).catch(console.error);
                       });
                    }
                 } catch(e){}
                 return NextResponse.json({ status: 'PAID', resNumber });
             } else {
                 return NextResponse.json({ status: 'PENDING' });
             }
         }
     }

     return NextResponse.json({ status: 'PENDING' });
  } catch (error: any) {
     return NextResponse.json({ error: 'Erro ao buscar reserva local' }, { status: 500 });
  }
}
