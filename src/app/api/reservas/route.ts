import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import prisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

// Função mock para gerar um Locator de reserva de 8 caracteres
function gerarLocalizador() {
   const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
   let result = '';
   for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
   }
   return result;
}

export async function POST(request: Request) {
   try {
      const { bookingData, customerData, paymentData } = await request.json();

      const forwardedFor = request.headers.get("x-forwarded-for");
      const ip = forwardedFor ? forwardedFor.split(',')[0] : 'Desconhecido';
      const session = await getServerSession(authOptions);
      const username = session?.user?.name || session?.user?.email || 'Visitante/Deslogado';
      const logOrigem = `Usuário: ${username} | IP: ${ip}`;

      const merchantOrderId = "ORD" + Date.now(); // Código do pedido pro gateway / banco de dados interno
      
      // ResNumber só é gerado agora se for Balcão ou CC. Se for PIX, será gerado depois pelo polling.
      let resNumber: string | null = paymentData.method !== 'PIX' ? gerarLocalizador() : null;

      let cieloConfig: any = null;
      try {
        cieloConfig = await prisma.cieloConfig.findFirst();
      } catch (dbErr: any) {
        // DB unreachable — fallback to environment variables for Cielo credentials
        console.warn('[reservas] DB indisponível, usando credenciais do .env como fallback:', dbErr.message);
        const envMerchantId = process.env.CIELO_MERCHANT_ID;
        const envMerchantKey = process.env.CIELO_MERCHANT_KEY;
        const envSandbox = process.env.CIELO_SANDBOX !== 'false';
        if ((paymentData.method === 'PIX' || paymentData.method === 'CREDIT') && envMerchantId && envMerchantKey) {
          cieloConfig = { merchantId: envMerchantId, merchantKey: envMerchantKey, isSandbox: envSandbox };
        } else if (paymentData.method === 'PIX' || paymentData.method === 'CREDIT') {
          return NextResponse.json({
            error: `Banco de dados indisponível e credenciais Cielo não encontradas no ambiente. Verifique se o projeto Supabase está ativo e tente novamente. (${dbErr.message})`
          }, { status: 503 });
        }
        // For BALCÃO, continue without DB config (will generate local ID)
      }

      if ((paymentData.method === 'PIX' || paymentData.method === 'CREDIT') && (!cieloConfig || !cieloConfig.merchantId || !cieloConfig.merchantKey)) {
         return NextResponse.json({ error: 'Chaves da Cielo não configuradas no Admin. Configure-as em /painel/config antes de testar pagamentos online.' }, { status: 400 });
      }

      // 1. Iniciar transação CIELO baseada no paymentData.method
      let cieloLog = "Não enviou para Cielo (Balcão)";
      let pixData: any = null;
      const CIELO_API_URL = cieloConfig?.isSandbox 
          ? "https://apisandbox.cieloecommerce.cielo.com.br/1/sales/" // Ambiente de Testes
          : "https://api.cieloecommerce.cielo.com.br/1/sales/"; // Produção Real
          
      const cieloHeaders = {
         "Content-Type": "application/json",
         "MerchantId": cieloConfig?.merchantId || '',
         "MerchantKey": cieloConfig?.merchantKey || ''
      };


      if (paymentData.method === 'PIX') {
         // Cielo PIX Real
         const resCielo = await fetch(CIELO_API_URL, {
             method: 'POST',
             headers: cieloHeaders,
             body: JSON.stringify({
                 "MerchantOrderId": merchantOrderId,
                 "Customer": { "Name": customerData.nome + " " + customerData.sobrenome, "Identity": customerData.cpf },
                 "Payment": {
                     "Type": "Pix",
                     "Amount": paymentData.amountInCents
                 }
             })
         });
         const resCieloText = await resCielo.text();
         let cieloResponseJson: any;
         try {
             cieloResponseJson = JSON.parse(resCieloText);
         } catch(e) {
             throw new Error("Sistema Cielo Indisponível ou Resposta Inesperada: HTTP " + resCielo.status + " Corpo: " + resCieloText);
         }
         
         try {
           await prisma.logCielo.create({
               data: {
                   endpoint: "POST /1/sales/ (PIX)",
                   payload: JSON.stringify({ amount: paymentData.amountInCents, type: 'Pix' }),
                   response: JSON.stringify(cieloResponseJson)
               }
           });
         } catch (logErr: any) {
           console.warn('[reservas] Falha ao salvar log Cielo (PIX):', logErr.message);
         }

         if (!resCielo.ok || !cieloResponseJson.Payment || !cieloResponseJson.Payment.QrCodeString) {
             throw new Error("Erro na Cielo ao gerar PIX: " + JSON.stringify(cieloResponseJson));
         }

         cieloLog = "Sucesso PIX Cielo.";
         pixData = {
            qrCodeBase64: cieloResponseJson.Payment.QrCodeBase64Image,
            qrCodeString: cieloResponseJson.Payment.QrCodeString,
            paymentId: cieloResponseJson.Payment.PaymentId
         };

      } else if (paymentData.method === 'CREDIT') {
         // Detectar bandeira basica
         const firstDigit = paymentData.creditCard.number.charAt(0);
         const brand = firstDigit === '4' ? 'Visa' : firstDigit === '5' ? 'Master' : firstDigit === '3' ? 'Amex' : 'Elo';
         
         // Format MM/YYYY
         let validityFormatted = paymentData.creditCard.validity;
         if (validityFormatted.length === 5 && validityFormatted.includes('/')) {
             const [mm, yy] = validityFormatted.split('/');
             validityFormatted = `${mm}/20${yy}`;
         }

         // Cielo Credit Card Real
         const resCielo = await fetch(CIELO_API_URL, {
             method: 'POST',
             headers: cieloHeaders,
             body: JSON.stringify({
                 "MerchantOrderId": merchantOrderId,
                 "Customer": { "Name": customerData.nome + " " + customerData.sobrenome, "Identity": customerData.cpf.replace(/\D/g, '') },
                 "Payment": {
                     "Type": "CreditCard",
                     "Amount": paymentData.amountInCents,
                     "Installments": 1,
                     "Capture": true, // Autoriza e Captura ao mesmo tempo
                     "CreditCard": {
                         "CardNumber": paymentData.creditCard.number.replace(/\D/g, ''),
                         "Holder": paymentData.creditCard.name,
                         "ExpirationDate": validityFormatted,
                         "SecurityCode": paymentData.creditCard.cvv,
                         "Brand": brand
                     }
                 }
             })
         });
         const resCieloText = await resCielo.text();
         let cieloResponseJson: any;
         try {
             cieloResponseJson = JSON.parse(resCieloText);
         } catch(e) {
             throw new Error("Sistema Cielo Indisponível ou Resposta Inesperada: HTTP " + resCielo.status + " Corpo: " + resCieloText);
         }

         try {
           await prisma.logCielo.create({
               data: {
                   endpoint: "POST /1/sales/ (CreditCard)",
                   payload: JSON.stringify({ amount: paymentData.amountInCents, type: 'CreditCard' }), // NO PAN/CVV logs here for security!
                   response: JSON.stringify(cieloResponseJson)
               }
           });
         } catch (logErr: any) {
           console.warn('[reservas] Falha ao salvar log Cielo (CC):', logErr.message);
         }

         if (!resCielo.ok || (cieloResponseJson.Payment.Status !== 1 && cieloResponseJson.Payment.Status !== 2)) {
             throw new Error("Pagamento Recusado pela Cielo: " + (cieloResponseJson.Payment?.ReturnMessage || JSON.stringify(cieloResponseJson)));
         }

         cieloLog = "Sucesso Cartão Cielo: " + cieloResponseJson.Payment.ReturnMessage;
      }

      // ✅ PCI-DSS: Remove dados sensíveis de pagamento antes de persistir no banco
      // Nunca gravar número de cartão, CVV ou dados completos — apenas últimos 4 dígitos mascarados
      const { creditCard: _cc, cvv: _cvv, cardNumber: _cn, ...safeCustomerData } = customerData as any;
      const cardLastFour = paymentData.creditCard?.number
        ? '**** **** **** ' + String(paymentData.creditCard.number.replace(/\D/g, '')).slice(-4)
        : undefined;

      let finalResNumber = resNumber;
      let finalMerchantOrderId = merchantOrderId;
      try {
        const localRes = await prisma.localReservation.create({
           data: {
              resNumber: resNumber,
              merchantOrderId,
              amountInCents: paymentData.amountInCents || 0,
              status: paymentData.method === 'PIX' ? 'PENDING_PIX' : (paymentData.method === 'BALCAO' ? 'CONFIRMED_NON_PREPAID' : 'CONFIRMED_PREPAID'),
              customerData: JSON.stringify({
                ...safeCustomerData,      // sem creditCard, cvv, cardNumber
                booking: bookingData,
                paymentId: pixData?.paymentId,
                systemLogOrigem: logOrigem,
                ...(cardLastFour && { cardLastFour }), // apenas **** **** **** 1234
              })
           }
        });
        finalResNumber = localRes.resNumber;
        finalMerchantOrderId = localRes.merchantOrderId;
      } catch (dbSaveErr: any) {
        // DB save failed — for BALCÃO, we still confirm with local ID
        // PIX/CREDIT would already have been charged, so log and continue
        console.error('DB save failed:', dbSaveErr.message);
        if (paymentData.method !== 'BALCAO') {
          throw new Error('Pagamento processado mas falha ao salvar reserva: ' + dbSaveErr.message);
        }
        // BALCÃO: use in-memory generated resNumber
      }

      return NextResponse.json({
         success: true,
         resNumber: finalResNumber,
         merchantOrderId: finalMerchantOrderId,
         pixData,
         cieloLog: `${cieloLog} | ${logOrigem}`
      });

   } catch (error: any) {
      console.error(error);
      return NextResponse.json({ error: 'Erro ao processar reserva: ' + error.message }, { status: 500 });
   }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resNumber = searchParams.get('resNumber');

  if (!resNumber) {
     return NextResponse.json({ error: 'resNumber is required' }, { status: 400 });
  }

  try {
     const reservaLocal = await prisma.localReservation.findUnique({
         where: { resNumber }
     });

     if (!reservaLocal) {
         return NextResponse.json({ error: 'Reserva não encontrada no banco local' }, { status: 404 });
     }

     return NextResponse.json(reservaLocal);
  } catch (error: any) {
     return NextResponse.json({ error: 'Erro ao buscar reserva local' }, { status: 500 });
  }
}
