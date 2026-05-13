import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import prisma from '@/lib/prisma';
import { callXRS } from '@/lib/europcar/xrsClient';

export const dynamic = 'force-dynamic';

// Helper to map CID to BA for ETO vouchers
const CID_TO_BA: Record<string, string> = {
  '56935466': '73675595',
  '56935495': '73804373'
};

export async function POST(request: Request) {
   try {
      const { bookingData, customerData, paymentData, voucherData } = await request.json();

      const forwardedFor = request.headers.get("x-forwarded-for");
      const ip = forwardedFor ? forwardedFor.split(',')[0] : 'Desconhecido';
      const session = await getServerSession(authOptions);
      const username = session?.user?.name || session?.user?.email || 'Visitante/Deslogado';
      const logOrigem = `Usuário: ${username} | IP: ${ip}`;

      const merchantOrderId = "ORD" + Date.now();
      
      let cieloConfig: any = null;
      try {
        cieloConfig = await prisma.cieloConfig.findFirst();
      } catch (dbErr: any) {
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
      }

      if ((paymentData.method === 'PIX' || paymentData.method === 'CREDIT') && (!cieloConfig || !cieloConfig.merchantId || !cieloConfig.merchantKey)) {
         return NextResponse.json({ error: 'Chaves da Cielo não configuradas no Admin. Configure-as em /painel/config antes de testar pagamentos online.' }, { status: 400 });
      }

      // 1. Iniciar transação CIELO baseada no paymentData.method
      let cieloLog = "Não enviou para Cielo";
      let pixData: any = null;
      const CIELO_API_URL = cieloConfig?.isSandbox 
          ? "https://apisandbox.cieloecommerce.cielo.com.br/1/sales/"
          : "https://api.cieloecommerce.cielo.com.br/1/sales/";
          
      const cieloHeaders = {
         "Content-Type": "application/json",
         "MerchantId": cieloConfig?.merchantId || '',
         "MerchantKey": cieloConfig?.merchantKey || ''
      };

      let paymentApproved = false;

      if (paymentData.method === 'PIX') {
         const resCielo = await fetch(CIELO_API_URL, {
             method: 'POST',
             headers: cieloHeaders,
             body: JSON.stringify({
                 "MerchantOrderId": merchantOrderId,
                 "Customer": { "Name": customerData.nome + " " + customerData.sobrenome, "Identity": customerData.cpf },
                 "Payment": { "Type": "Pix", "Amount": paymentData.amountInCents }
             })
         });
         const cieloResponseJson = await resCielo.json();
         
         if (!resCielo.ok || !cieloResponseJson.Payment || !cieloResponseJson.Payment.QrCodeString) {
             throw new Error("Erro na Cielo ao gerar PIX: " + JSON.stringify(cieloResponseJson));
         }

         cieloLog = "Sucesso PIX Cielo.";
         pixData = {
            qrCodeBase64: cieloResponseJson.Payment.QrCodeBase64Image,
            qrCodeString: cieloResponseJson.Payment.QrCodeString,
            paymentId: cieloResponseJson.Payment.PaymentId
         };
         // PIX is not approved yet, reservation will be created later by status webhook/polling
      } else if (paymentData.method === 'CREDIT') {
         const firstDigit = paymentData.creditCard.number.charAt(0);
         const brand = firstDigit === '4' ? 'Visa' : firstDigit === '5' ? 'Master' : firstDigit === '3' ? 'Amex' : 'Elo';
         let validityFormatted = paymentData.creditCard.validity;
         if (validityFormatted.length === 5 && validityFormatted.includes('/')) {
             const [mm, yy] = validityFormatted.split('/');
             validityFormatted = `${mm}/20${yy}`;
         }

         const resCielo = await fetch(CIELO_API_URL, {
             method: 'POST',
             headers: cieloHeaders,
             body: JSON.stringify({
                 "MerchantOrderId": merchantOrderId,
                 "Customer": { "Name": customerData.nome + " " + customerData.sobrenome, "Identity": customerData.cpf.replace(/\D/g, '') },
                 "Payment": {
                     "Type": "CreditCard", "Amount": paymentData.amountInCents, "Installments": 1, "Capture": true,
                     "CreditCard": {
                         "CardNumber": paymentData.creditCard.number.replace(/\D/g, ''),
                         "Holder": paymentData.creditCard.name,
                         "ExpirationDate": validityFormatted,
                         "SecurityCode": paymentData.creditCard.cvv,
                          brand
                     }
                 }
             })
         });
         const cieloResponseJson = await resCielo.json();

         if (!resCielo.ok || (cieloResponseJson.Payment.Status !== 1 && cieloResponseJson.Payment.Status !== 2)) {
             throw new Error("Pagamento Recusado pela Cielo: " + (cieloResponseJson.Payment?.ReturnMessage || JSON.stringify(cieloResponseJson)));
         }

         cieloLog = "Sucesso Cartão Cielo: " + cieloResponseJson.Payment.ReturnMessage;
         paymentApproved = true;
      } else if (paymentData.method === 'BALCAO' || paymentData.method === 'VOUCHER') {
         paymentApproved = true;
      }

      // 2. Chamar Europcar XRS bookReservation se o pagamento estiver aprovado (ou for Balcão/Voucher)
      let resNumber: string | null = null;
      let isOnRequest = false;
      let onRequestItems: any[] = [];
      if (paymentApproved) {
        const car = bookingData.car || {};
        const pickupDate = bookingData.pickupDate;
        const returnDate = bookingData.returnDate;
        const pickupStation = bookingData.pickupStation;
        const returnStation = bookingData.returnStation || pickupStation;
        const contractID = bookingData.contractID || "";
        const carCategory = car.carCategoryCode;
        let rateId = car.rateId;
        let productDataAttr = '';

        // ✅ Refresh do rateId via getQuote antes de reservar
        try {
          const numericVoucherID = (voucherData?.id && /^\d+$/.test(voucherData.id)) 
            ? voucherData.id 
            : Date.now().toString().slice(-8);

          const meanOfPaymentForQuote = paymentData.method === 'VOUCHER' && voucherData?.type === 'ETO'
            ? (() => {
                const ba = CID_TO_BA[contractID] || voucherData.businessAccount || '';
                const d1 = new Date(parseInt(pickupDate.slice(0,4)), parseInt(pickupDate.slice(4,6))-1, parseInt(pickupDate.slice(6,8)));
                const d2 = new Date(parseInt(returnDate.slice(0,4)), parseInt(returnDate.slice(4,6))-1, parseInt(returnDate.slice(6,8)));
                const duration = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
                // voucherFullCredit="Y" é essencial para faturamento total (Full Credit)
                return `<meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${numericVoucherID}" businessAccount="${ba}" voucherCarCategory="${carCategory}" voucherRentalDuration="${duration}" voucherFullCredit="Y"/>`;
              })()
            : '';

          const quoteXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getQuote">
    <serviceParameters>
      <reservation carCategory="${carCategory}"${contractID ? ` contractID="${contractID}" type="C"` : ''} chargesDetail="TRE" rateId="${rateId}">
        <checkout stationID="${pickupStation}" date="${pickupDate}" time="${bookingData.pickupTime || '1000'}"/>
        <checkin stationID="${returnStation}" date="${returnDate}" time="${bookingData.returnTime || '1000'}"/>
        ${meanOfPaymentForQuote}
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

          const quoteRes = await callXRS(quoteXml, {
            callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
            password: process.env.XRS_PASSWORD || 'DEMO',
            action: 'getQuote',
            sourceFile: 'reservas/route.ts'
          });
          
          const resNode = quoteRes?.message?.serviceResponse?.reservation?.$ || quoteRes?.serviceResponse?.reservation?.$;
          if (resNode?.rateId) rateId = resNode.rateId;
          
          // Capturar metadados do produto que podem ser exigidos no book
          if (resNode?.productCode) productDataAttr += ` productCode="${resNode.productCode}"`;
          if (resNode?.productFamily) productDataAttr += ` productFamily="${resNode.productFamily}"`;
          if (resNode?.productVersion) productDataAttr += ` productVersion="${resNode.productVersion}"`;
          
        } catch (quoteErr: any) {
          console.warn('[reservas] Erro no refresh do rateId:', quoteErr.message);
        }

        const contractAttr = contractID ? ` contractID="${contractID}" type="C"` : '';

        let meanOfPaymentXml = '';
        if (paymentData.method === 'VOUCHER' && voucherData?.type === 'ETO') {
          const ba = CID_TO_BA[contractID] || voucherData.businessAccount || '';
          const d1 = new Date(parseInt(pickupDate.slice(0,4)), parseInt(pickupDate.slice(4,6))-1, parseInt(pickupDate.slice(6,8)));
          const d2 = new Date(parseInt(returnDate.slice(0,4)), parseInt(returnDate.slice(4,6))-1, parseInt(returnDate.slice(6,8)));
          const duration = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
          
        const numericVoucherID = (voucherData?.id && /^\d+$/.test(voucherData.id)) 
          ? voucherData.id 
          : Date.now().toString().slice(-8);

        meanOfPaymentXml = `
        <meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${numericVoucherID}"
                       businessAccount="${ba}" voucherCarCategory="${carCategory}"
                       voucherRentalDuration="${duration}" voucherFullCredit="Y"/>`;
        }

        const prepaidAttr = paymentData.method === 'VOUCHER' ? '' : ' prepaidMode="NP"';

        const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${carCategory}" rateId="${rateId}"${prepaidAttr}${contractAttr}${productDataAttr} preferredLanguage="pt_BR">
        <checkout stationID="${pickupStation}" date="${pickupDate}" time="${bookingData.pickupTime || '1000'}"/>
        <checkin stationID="${returnStation}" date="${returnDate}" time="${bookingData.returnTime || '1000'}"/>
        <equipmentList/>${meanOfPaymentXml.replace('voucherFullCredit="Y"', 'voucherFullCredit="N"')}
      </reservation>
      <driver countryOfResidence="BR"
              firstName="${customerData.nome.trim()}"
              lastName="${customerData.sobrenome.trim()}"
              title="MR"
              driverID="${customerData.cpf.replace(/\D/g, '').slice(0, 11)}"
              email="${customerData.email.trim()}"
              phone="${customerData.telefone}"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

        const xrsConfig = {
          callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
          password: process.env.XRS_PASSWORD || 'DEMO',
          action: 'bookReservation',
          sourceFile: 'reservas/route.ts'
        };

        const xrsResponse = await callXRS(xmlRequest, xrsConfig);
        const bookResNode = xrsResponse?.message?.serviceResponse?.reservation || xrsResponse?.serviceResponse?.reservation;
        resNumber = bookResNode?.$?.resNumber || null;

        if (!resNumber) {
          throw new Error("Europcar não retornou número de reserva. Verifique os logs.");
        }

        const xrsStatusCode: string = bookResNode?.$?.statusCode || 'S';
        isOnRequest = xrsStatusCode === 'R';
        if (isOnRequest) {
          const raw = bookResNode?.onRequestItemList?.onRequestItem;
          if (Array.isArray(raw)) {
            onRequestItems = raw.map((i: any) => i.$ || i);
          } else if (raw) {
            onRequestItems = [raw.$ || raw];
          }
        }
      }

      // 3. Salvar no Banco de Dados local
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
              status: isOnRequest ? 'ON_REQUEST' : (paymentData.method === 'PIX' ? 'PENDING_PIX' : (paymentData.method === 'BALCAO' ? 'CONFIRMED_NON_PREPAID' : 'CONFIRMED_PREPAID')),
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
         onRequest: isOnRequest,
         onRequestItems,
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
