import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import prisma from '@/lib/prisma';
import { callXRS, DEFAULT_POA_CID } from '@/lib/europcar/xrsClient';
import { sendBookingConfirmation } from '@/lib/email/sendBookingConfirmation';

export const dynamic = 'force-dynamic';

// Helper to map CID to BA for ETO vouchers
const CID_TO_BA: Record<string, string> = {
  '56935466': '73675595',  // ETO Líquido (Excesso)
  '56935495': '73804373',  // ETO Internacional (Excesso Zero)
};

export async function POST(request: Request) {
   let customerEmail = '';
   let customerName = '';
   try {
      const { bookingData, customerData, paymentData, voucherData, xrsEquipment, xrsInsurances } = await request.json();
      customerEmail = customerData?.email || '';
      customerName = customerData?.nome || '';

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
         const pixPayload = {
             "MerchantOrderId": merchantOrderId,
             "Customer": { "Name": customerData.nome + " " + customerData.sobrenome, "Identity": customerData.cpf },
             "Payment": { "Type": "Pix", "Amount": paymentData.amountInCents }
         };

         const resCielo = await fetch(CIELO_API_URL, {
             method: 'POST',
             headers: cieloHeaders,
             body: JSON.stringify(pixPayload)
         });
         
         const rawPixText = await resCielo.text();
         
         prisma.logCielo.create({
             data: {
                 endpoint: CIELO_API_URL,
                 payload: JSON.stringify(pixPayload),
                 response: rawPixText || `[Resposta Vazia] HTTP ${resCielo.status}`
             }
         }).catch(console.error);

         let cieloResponseJson: any = {};
         try {
             cieloResponseJson = rawPixText ? JSON.parse(rawPixText) : {};
         } catch (parseErr) {
             throw new Error(`Erro de Comunicação com a Cielo (HTTP ${resCielo.status}). Verifique as configurações de chave no painel.`);
         }
         
         if (!resCielo.ok || !cieloResponseJson.Payment || !cieloResponseJson.Payment.QrCodeString) {
             let errorMsg = cieloResponseJson.Payment?.ReturnMessage;
             if (!errorMsg && Array.isArray(cieloResponseJson) && cieloResponseJson[0]?.Message) {
                 errorMsg = cieloResponseJson.map((e: any) => e.Message).join(', ');
             }
             if (!errorMsg) errorMsg = `Código HTTP ${resCielo.status}`;
             throw new Error("Transação PIX Recusada: " + errorMsg);
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

         const cieloPayload = {
             "MerchantOrderId": merchantOrderId,
             "Customer": { "Name": customerData.nome + " " + customerData.sobrenome, "Identity": customerData.cpf.replace(/\D/g, '') },
             "Payment": {
                 "Type": "CreditCard", "Amount": paymentData.amountInCents, "Installments": 1, "Capture": true,
                 "CreditCard": {
                     "CardNumber": paymentData.creditCard.number.replace(/\D/g, ''),
                     "Holder": paymentData.creditCard.name,
                     "ExpirationDate": validityFormatted,
                     "SecurityCode": paymentData.creditCard.cvv,
                     "Brand": brand
                 }
             }
         };

         const resCielo = await fetch(CIELO_API_URL, {
             method: 'POST',
             headers: cieloHeaders,
             body: JSON.stringify(cieloPayload)
         });
         
         const rawText = await resCielo.text();
         
         // Salva log no banco para aparecer no painel
         prisma.logCielo.create({
             data: {
                 endpoint: CIELO_API_URL,
                 payload: JSON.stringify(cieloPayload),
                 response: rawText || `[Resposta Vazia] HTTP ${resCielo.status}`
             }
         }).catch(console.error);

         let cieloResponseJson: any = {};
         try {
             cieloResponseJson = rawText ? JSON.parse(rawText) : {};
         } catch (parseErr) {
             throw new Error(`Erro de Comunicação com a Cielo (HTTP ${resCielo.status}). Verifique as configurações de chave no painel.`);
         }

         if (!resCielo.ok || (cieloResponseJson.Payment?.Status !== 1 && cieloResponseJson.Payment?.Status !== 2)) {
             let errorMsg = cieloResponseJson.Payment?.ReturnMessage;
             if (!errorMsg && Array.isArray(cieloResponseJson) && cieloResponseJson[0]?.Message) {
                 errorMsg = cieloResponseJson.map((e: any) => e.Message).join(', ');
             }
             if (!errorMsg) errorMsg = `Código HTTP ${resCielo.status}`;
             
             throw new Error("Transação Recusada pela Operadora do Cartão: " + errorMsg);
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
        const contractID = bookingData.contractID || DEFAULT_POA_CID;
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
                return `<meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${numericVoucherID}" businessAccount="${ba}" voucherCarCategory="${carCategory}" voucherRentalDuration="${duration}"/>`;
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

        // Build equipment XML from booking extras (correct format: code/qty)
        let equipmentXml = '';
        const extras = bookingData.extras || {};
        const extraKeys = Object.keys(extras).filter(k => extras[k] > 0);
        // Only include equipment codes (not insurance codes like CDW, LDW, etc.)
        const insuranceCodes = ['TPL','LDW','CDW','THW','SCDW','SPCDW','STHW','SPTHW','MEDIUM','PREMIUM','PREMPRE','PREMUP','RSA','APP','PAI','PEP','SLDW','WWI','SPAI'];
        const equipmentKeys = extraKeys.filter(k => !insuranceCodes.includes(k));
        if (equipmentKeys.length > 0) {
          equipmentXml = equipmentKeys.map(k => `\n          <equipment code="${k}" qty="${extras[k]}"/>`).join('');
        }

        // Also include XRS equipment from Step 3
        if (Array.isArray(xrsEquipment) && xrsEquipment.length > 0) {
          const xrsEqItems = xrsEquipment
            .filter((eq: any) => eq.code && eq.qty > 0)
            .map((eq: any) => `\n          <equipment code="${eq.code}" qty="${eq.qty}"/>`)
            .join('');
          equipmentXml += xrsEqItems;
        }

        // Build insurance XML from extras map + xrsInsurances
        let insuranceXml = '';
        const selectedInsKeys = extraKeys.filter(k => insuranceCodes.includes(k));
        const allInsCodes = new Set<string>([
          ...selectedInsKeys,
          ...(Array.isArray(xrsInsurances) ? xrsInsurances.map((ins: any) => ins.code || ins).filter(Boolean) : []),
        ]);
        if (allInsCodes.size > 0) {
          insuranceXml = [...allInsCodes].map(code => `\n          <insurance code="${code}"/>`).join('');
        }

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
                       voucherRentalDuration="${duration}"/>`;
        }

        const prepaidAttr = (paymentData.method === 'VOUCHER' && voucherData?.type === 'ETO') ? '' : ' prepaidMode="NP"';

        const { loyaltyProgramId, loyaltyId } = customerData;
        let loyaltyXml = '';
        if (loyaltyProgramId && loyaltyId) {
          loyaltyXml = `\n        <loyaltyProgram programId="${loyaltyProgramId}" loyaltyID="${loyaltyId}"/>`;
        }

        const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${carCategory}" rateId="${rateId}"${prepaidAttr}${contractAttr}${productDataAttr} preferredLanguage="pt_BR" email="${customerData.email.trim()}">
        <checkout stationID="${pickupStation}" date="${pickupDate}" time="${bookingData.pickupTime || '1000'}"/>
        <checkin stationID="${returnStation}" date="${returnDate}" time="${bookingData.returnTime || '1000'}"/>
        <equipmentList>${equipmentXml}</equipmentList>${insuranceXml ? `\n        <insuranceList>${insuranceXml}\n        </insuranceList>` : ''}${meanOfPaymentXml}${loyaltyXml}
      </reservation>
      <driver countryOfResidence="BR"
              firstName="${customerData.nome.trim()}"
              lastName="${customerData.sobrenome.trim()}"
              title="MR"/>
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

        if (resNumber) {
          try {
            const dFirstName = customerData.nome.trim();
            const dLastName = customerData.sobrenome.trim();
            const dEmail = customerData.email.trim();
            const dPhone = customerData.telefone || '';
            const dCpf = customerData.cpf.replace(/\D/g, '').slice(0, 11);
            const dCountry = customerData.paisEmissao || bookingData?.country || 'BR';

            // Build licenseList XML if CNH data is available
            let licenseListXml = '';
            if (customerData.cnhNumero || customerData.cnhValidade) {
              let expirationDate = '';
              if (customerData.cnhValidade) {
                const parts = customerData.cnhValidade.replace(/\D/g, '/').split('/');
                if (parts.length === 2) {
                  const [mm, yyyy] = parts;
                  const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
                  expirationDate = `${year}${mm.padStart(2, '0')}01`;
                }
              }
              licenseListXml = `
        <licenseList>
          <license licenseNumber="${customerData.cnhNumero || ''}"${expirationDate ? ` expirationDate="${expirationDate}"` : ''}${customerData.cnhCidade ? ` cityOfIssuance="${customerData.cnhCidade}"` : ''} countryOfIssuance="${dCountry}"/>
        </licenseList>`;
            }

            const createDriverXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="createDriver">
    <serviceParameters>
      <reservation resNumber="${resNumber}"/>
      <driver isoLanguage="pt_BR" firstName="${dFirstName}" lastName="${dLastName}" title="MR">
        <addressList>
          <address addressType="P" addressKind="D" addressCountry="${dCountry}">
            <emails>
              <email emailAddress="${dEmail}" type="M"/>
            </emails>
            <phones>
              <phone phoneNumber="${dPhone}" phoneType="M"/>
            </phones>
          </address>
        </addressList>
        <legalIdList>
          <legalId idTy="P" docNumber="${dCpf}" country="${dCountry}"/>
        </legalIdList>${licenseListXml}
      </driver>
    </serviceParameters>
  </serviceRequest>
</message>`;

            await callXRS(createDriverXml, {
              callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
              password: process.env.XRS_PASSWORD || 'DEMO',
              action: 'createDriver',
              sourceFile: 'reservas/route.ts'
            });
            console.log(`[reservas] createDriver enviado com sucesso para a reserva ${resNumber}`);
          } catch (driverErr: any) {
            console.error(`[reservas] Erro ao criar driver para ${resNumber}:`, driverErr.message);
          }
        }

        // Se for EXO Voucher, envia requisição adicional createVoucher após criar reserva como POA
        if (resNumber && paymentData.method === 'VOUCHER' && voucherData?.type === 'EXO') {
          try {
            const voucherAmount = car.totalRateEstimate || car.total || '0';
            const voucherCurrency = car.bookingCurrencyOfTotalRateEstimate || car.currency || 'EUR';
            const iataNumber = voucherData.iataNumber || '02170722';

            const createVoucherXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="createVoucher">
    <serviceParameters>
      <reservation resNumber="${resNumber}">
        <meanOfPayment typeCode="VCH" voucherType="EXO" IATANumber="${iataNumber}" voucherAmount="${voucherAmount}" voucherCurrency="${voucherCurrency}"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`;

            await callXRS(createVoucherXml, {
              callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
              password: process.env.XRS_PASSWORD || 'DEMO',
              action: 'createVoucher',
              sourceFile: 'reservas/route.ts'
            });
            console.log(`[reservas] createVoucher (EXO) enviado com sucesso para a reserva ${resNumber}`);
          } catch (voucherErr: any) {
            console.error(`[reservas] Erro ao criar voucher EXO para ${resNumber}:`, voucherErr.message);
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

      // 4. Send Email Confirmation
      if (finalResNumber && paymentData.method !== 'PIX') {
        // Only send if it's not PIX (PIX sends after payment confirmation)
        try {
          import('@/lib/emailService').then(({ sendTransactionalEmail }) => {
             sendTransactionalEmail(customerData.email, 'RESERVA_SUCESSO', {
               NOME: customerData.nome || '',
               NUMERO_RESERVA: finalResNumber || '',
               VALOR: ((paymentData.amountInCents || 0) / 100).toFixed(2),
               DATA_RETIRADA: bookingData.pickupDate || '',
               CARRO: bookingData.car?.carCategoryName || bookingData.car?.name || ''
             }).catch(console.error);
          });
        } catch (emailErr) {
          console.error('[reservas] Error calling sendTransactionalEmail:', emailErr);
        }

        // Also send detailed HTML confirmation with equipment & extras
        try {
          const insNames: Record<string, string> = {
            TPL: 'Resp. Civil', LDW: 'Danos e Roubo', CDW: 'Colisão', THW: 'Roubo',
            SCDW: 'Super CDW', PAI: 'Acidentes Pessoais', PEP: 'Efeitos Pessoais',
            RSA: 'Assistência na Estrada', APP: 'Proteção de Aparência',
          };
          const extrasMap = bookingData.extras || {};
          const extrasArr = Object.entries(extrasMap)
            .filter(([, v]: any) => v > 0)
            .map(([code, qty]: any) => ({ code, name: insNames[code] || code, qty }));

          sendBookingConfirmation({
            toEmail: customerData.email,
            customerName: `${customerData.nome} ${customerData.sobrenome}`,
            resNumber: finalResNumber,
            carName: bookingData.car?.carCategoryName || bookingData.car?.name || '',
            pickupStation,
            returnStation,
            pickupDate,
            returnDate,
            paymentMethod: paymentData.method,
            totalBRL: (paymentData.amountInCents || 0) / 100,
            isOnRequest,
            xrsEquipment: Array.isArray(xrsEquipment) ? xrsEquipment : [],
            extras: extrasArr,
          });
        } catch (emailErr2) {
          console.error('[reservas] Error sending detailed confirmation:', emailErr2);
        }
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
      
      // Trigger Falha Pagamento — envia para QUALQUER erro no processamento
      if (customerEmail) {
        try {
           import('@/lib/emailService').then(({ sendTransactionalEmail }) => {
              sendTransactionalEmail(customerEmail, 'FALHA_PAGAMENTO', {
                NOME: customerName,
                NUMERO_RESERVA: '',
                ERRO: (error.message || 'Erro desconhecido').slice(0, 200)
              }).catch(console.error);
           });
        } catch(e){}
      }
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
