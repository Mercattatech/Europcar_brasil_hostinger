import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import prisma from '@/lib/prisma';
import { callXRS, DEFAULT_POA_CID } from '@/lib/europcar/xrsClient';
import { sendBookingConfirmation } from '@/lib/email/sendBookingConfirmation';
import { sendWelcomeWithCredentials } from '@/lib/email/sendWelcomeWithCredentials';
import { consultarBin, guessBrandByFirstDigit, mapBrandToCardIssuer, zeroAuthCard, voidCieloPayment } from '@/lib/cielo/cieloClient';
import { buildReservationPaymentAttrs, buildCreateVoucherXml } from '@/lib/europcar/paymentMapping';
import { getReservationErrorMessage } from '@/lib/cms/reservationErrors';
import bcrypt from 'bcryptjs';

/** Gera senha aleatória legível de 12 caracteres */
function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export const dynamic = 'force-dynamic';

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

      // Cartão de crédito autentica o 3DS no cliente ANTES de chamar esta rota, usando um
      // MerchantOrderId próprio (bpmpi_ordernumber). Reaproveita o mesmo valor na cobrança
      // Cielo — se vierem diferentes, o banco emissor pode recusar por inconsistência entre
      // a autenticação e a venda. Sanitiza para não injetar valor arbitrário no payload Cielo/XRS.
      const clientOrderId = typeof paymentData?.merchantOrderId === 'string'
        ? paymentData.merchantOrderId.replace(/[^A-Za-z0-9]/g, '').slice(0, 40)
        : '';
      const merchantOrderId = clientOrderId || ("ORD" + Date.now());
      
      let cieloConfig: any = null;
      try {
        cieloConfig = await prisma.cieloConfig.findFirst();
      } catch (dbErr: any) {
        console.warn('[reservas] Prisma findFirst falhou (migration pendente?):', dbErr.message);
        // Fallback: busca apenas as colunas base via query SQL raw para não crashar se 3DS columns não existem
        try {
          const rows = await prisma.$queryRaw<any[]>`SELECT "id", "merchantId", "merchantKey", "isSandbox", "clientId3ds", "clientSecret3ds", "updatedAt" FROM "CieloConfig" LIMIT 1`;
          if (rows.length > 0) cieloConfig = rows[0];
        } catch (rawErr: any) {
          console.warn('[reservas] Raw query também falhou:', rawErr.message);
        }
      }

      // Fallback para .env caso não tenha sido configurado no painel ou o banco falhe
      if (!cieloConfig || !cieloConfig.merchantId) {
        const envMerchantId = process.env.CIELO_MERCHANT_ID;
        const envMerchantKey = process.env.CIELO_MERCHANT_KEY;
        const envSandbox = process.env.CIELO_SANDBOX !== 'false';
        
        if (envMerchantId && envMerchantKey) {
          cieloConfig = { merchantId: envMerchantId, merchantKey: envMerchantKey, isSandbox: envSandbox };
        }
      }

      if ((paymentData.method === 'PIX' || paymentData.method === 'CREDIT') && (!cieloConfig || !cieloConfig.merchantId || !cieloConfig.merchantKey)) {
         return NextResponse.json({ error: 'Chaves da Cielo não configuradas no Admin e nem no .env.' }, { status: 400 });
      }

      // 1. Iniciar transação CIELO baseada no paymentData.method
      let cieloLog = "Não enviou para Cielo";
      let pixData: any = null;

      // CRITICAL: força coerção explícita de boolean para isSandbox
      // Evita bugs onde raw SQL retorna tipo inesperado ou migration não rodou
      const isSandboxMode = cieloConfig?.isSandbox === true;
      
      const CIELO_API_URL = isSandboxMode
          ? "https://apisandbox.cieloecommerce.cielo.com.br/1/sales/"
          : "https://api.cieloecommerce.cielo.com.br/1/sales/";
          
      console.log(`[reservas] Modo: ${isSandboxMode ? '🧪 SANDBOX' : '🚀 PRODUÇÃO'} | URL: ${CIELO_API_URL} | MerchantId: ${cieloConfig?.merchantId?.substring(0,8)}...`);
          
      // .trim() defensivo: dados já salvos no banco podem ter espaço/quebra de linha
      // invisível de um copiar-colar antigo, o que a Cielo tolera em /1/card mas rejeita
      // com 401 em /1/sales — sintoma de "teste OK, pagamento real recusado".
      const cieloHeaders = {
         "Content-Type": "application/json",
         "MerchantId": String(cieloConfig?.merchantId || '').trim(),
         "MerchantKey": String(cieloConfig?.merchantKey || '').trim()
      };

      // Campos de identificação do lojista para 3DS 2.2 (Erros 605, 606, 607)
      const merchantName      = cieloConfig?.merchantName      || 'Europcar Brasil';
      const establishmentCode = cieloConfig?.establishmentCode || '';
      const mcc               = cieloConfig?.mcc               || '7512';

      let paymentApproved = false;
      // Preenchido no fluxo CREDIT — usado depois para decidir prepaidMode="PP" (cobrado
      // agora) e, se algum dia existir um fluxo de garantia sem captura, o nó meanOfPayment CC.
      let capturedCreditCard: { number: string; holderName: string; validity: string; cardIssuer: string; captured: boolean } | undefined;
      // PaymentId da Cielo (CREDIT) — guardado no registro local para permitir estorno (void) em caso de cancelamento.
      let cieloPaymentId: string | undefined;

      if (paymentData.method === 'PIX') {
         const pixPayload = {
             "MerchantOrderId": merchantOrderId,
             // Campos de identificação do lojista — obrigatórios para 3DS 2.2 (Erros 605/606/607)
             ...(establishmentCode && { "EstablishmentCode": establishmentCode }),
             ...(merchantName      && { "MerchantName":      merchantName }),
             "MerchantCategoryCode": mcc,
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
             let msg = `Erro de Comunicação com a Cielo PIX (HTTP ${resCielo.status}).`;
             if (resCielo.status === 401) {
                 msg = "Erro 401 (Não Autorizado) na Cielo PIX. Verifique se o MerchantId e MerchantKey estão corretos. Se estiver usando chaves de Produção, o 'Modo Sandbox' deve estar DESMARCADO.";
             }
             throw new Error(msg);
         }
         
         if (!resCielo.ok || !cieloResponseJson.Payment || !cieloResponseJson.Payment.QrCodeString) {
             let errorMsg = cieloResponseJson.Payment?.ReturnMessage;
             if (!errorMsg && Array.isArray(cieloResponseJson) && cieloResponseJson[0]?.Message) {
                 errorMsg = cieloResponseJson.map((e: any) => e.Message).join(', ');
             }
             // Mapeamento CMS: se a Cielo retornar um ReturnCode conhecido, busca a mensagem
             // amigável em ContentBlock["reservation.error.<code>"] antes de cair no fallback técnico.
             const pixReturnCode = cieloResponseJson.Payment?.ReturnCode ?? (Array.isArray(cieloResponseJson) ? cieloResponseJson[0]?.Code : undefined);
             if (!errorMsg) {
                 // Sem shape reconhecido (nem Payment.ReturnMessage, nem array de erros) —
                 // repassa o corpo bruto retornado pela Cielo para diagnóstico, em vez de
                 // adivinhar a causa. Ver também /painel/logs (LogCielo) para o histórico completo.
                 errorMsg = `Código HTTP ${resCielo.status}. Resposta Cielo: ${rawPixText.slice(0, 300) || '[vazia]'}`;
             }
             errorMsg = await getReservationErrorMessage(pixReturnCode, errorMsg);
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
         let validityFormatted = paymentData.creditCard.validity;
         if (validityFormatted.length === 5 && validityFormatted.includes('/')) {
             const [mm, yy] = validityFormatted.split('/');
             validityFormatted = `${mm}/20${yy}`;
         }

         const threeDsAuth = paymentData.creditCard?.threeDsAuth;
         const cardNumClean = paymentData.creditCard.number.replace(/\D/g, '');
         // SEGURANÇA: nunca loga o PAN completo — apenas os 4 últimos dígitos
         const cardMasked = `**** **** **** ${cardNumClean.slice(-4)}`;

         // Consulta BIN — identifica a bandeira real pelos 6 primeiros dígitos (mais
         // preciso que adivinhar pelo primeiro dígito, essencial para Elo x Master x Visa).
         const binInfo = await consultarBin(cardNumClean, cieloHeaders.MerchantId, cieloHeaders.MerchantKey, isSandboxMode);
         const brand = binInfo?.brand || guessBrandByFirstDigit(cardNumClean);
         const cardIssuer = binInfo?.cardIssuer || mapBrandToCardIssuer(brand);

         // Zero Auth — valida se o cartão é funcional ANTES de autorizar, evitando
         // processar uma reserva no XRS para um cartão que nem passa na validação básica.
         const zeroAuth = await zeroAuthCard(
           { number: cardNumClean, holder: paymentData.creditCard.name, expirationDate: validityFormatted, brand },
           cieloHeaders.MerchantId, cieloHeaders.MerchantKey, isSandboxMode
         );
         if (!zeroAuth.valid) {
           const msg = await getReservationErrorMessage('ZERO_AUTH', zeroAuth.message || 'Cartão inválido ou não autorizado pelo emissor.');
           throw new Error("Transação Recusada pela Operadora: " + msg);
         }

         const cieloPaymentNode: any = {
             "Type": "CreditCard",
             "Amount": paymentData.amountInCents,
             "Installments": 1,
             "Capture": true,
             "SoftDescriptor": "EUROPCAR",
             "CreditCard": {
                 "CardNumber": cardNumClean,
                 "Holder": paymentData.creditCard.name,
                 "ExpirationDate": validityFormatted,
                 "SecurityCode": paymentData.creditCard.cvv,
                 "Brand": brand
             }
         };

         // Adiciona nó 3DS quando autenticação foi realizada pelo script Braspag MPI
         if (threeDsAuth?.cavv && threeDsAuth?.eci) {
             cieloPaymentNode.ExternalAuthentication = {
                 Cavv: threeDsAuth.cavv,
                 Xid: threeDsAuth.xid,
                 Eci: threeDsAuth.eci,
                 Version: threeDsAuth.version || '2',
                 ReferenceID: threeDsAuth.referenceId || '',
             };
             console.log(`[Cielo] Cartão ${cardMasked} | 3DS ECI=${threeDsAuth.eci} | LiabilityShift=${['02','05','2','5'].includes(threeDsAuth.eci) ? 'SIM' : 'NÃO'}`);
         } else {
             console.warn(`[Cielo] Cartão ${cardMasked} | SEM 3DS — processando sem Liability Shift`);
         }

         const cieloPayload = {
             "MerchantOrderId": merchantOrderId,
             // Campos de identificação do lojista — obrigatórios para 3DS 2.2 (Erros 605/606/607)
             ...(establishmentCode && { "EstablishmentCode": establishmentCode }),
             ...(merchantName      && { "MerchantName":      merchantName }),
             "MerchantCategoryCode": mcc,
             "Customer": { "Name": customerData.nome + " " + customerData.sobrenome, "Identity": customerData.cpf.replace(/\D/g, '') },
             "Payment": cieloPaymentNode
         };

         // Log seguro: substitui CardNumber pelo valor mascarado
         const safePayload = JSON.parse(JSON.stringify(cieloPayload));
         safePayload.Payment.CreditCard.CardNumber = cardMasked;
         safePayload.Payment.CreditCard.SecurityCode = '***';

         const resCielo = await fetch(CIELO_API_URL, {
             method: 'POST',
             headers: cieloHeaders,
             body: JSON.stringify(cieloPayload)
         });
         
         const rawText = await resCielo.text();
         
         // Salva log no banco com dados mascarados
         prisma.logCielo.create({
             data: {
                 endpoint: CIELO_API_URL,
                 payload: JSON.stringify(safePayload),
                 response: rawText || `[Resposta Vazia] HTTP ${resCielo.status}`
             }
         }).catch(console.error);


         let cieloResponseJson: any = {};
         try {
             cieloResponseJson = rawText ? JSON.parse(rawText) : {};
         } catch (parseErr) {
             let msg = `Erro de Comunicação com a Cielo (HTTP ${resCielo.status}).`;
             if (resCielo.status === 401) {
                 msg = "Erro 401 (Não Autorizado) na Cielo. Verifique se o MerchantId e MerchantKey estão corretos. Se estiver usando chaves de Produção, verifique se o botão 'Modo Sandbox' está DESMARCADO no painel. Chaves reais não funcionam no Sandbox.";
             }
             throw new Error(msg);
         }

         if (!resCielo.ok || (cieloResponseJson.Payment?.Status !== 1 && cieloResponseJson.Payment?.Status !== 2)) {
             let errorMsg = cieloResponseJson.Payment?.ReturnMessage;
             const returnCode = cieloResponseJson.Payment?.ReturnCode ?? (Array.isArray(cieloResponseJson) ? cieloResponseJson[0]?.Code : undefined);

             // Fallback técnico padrão — o mapeamento CMS (reservation.error.<code>) abaixo
             // tem prioridade quando o admin cadastrar uma mensagem para o código específico.
             if (returnCode === "002" || returnCode === "2") {
                 errorMsg = `A sua conta Cielo não está habilitada para processar esta bandeira de cartão (${brand}), ou o seu cadastro na Cielo ainda não foi ativado (Credenciais Inválidas - 002). Contate o suporte da Cielo.`;
             } else if (!errorMsg && Array.isArray(cieloResponseJson) && cieloResponseJson[0]?.Message) {
                 errorMsg = cieloResponseJson.map((e: any) => e.Message).join(', ');
             }
             if (!errorMsg) {
                 // Sem shape reconhecido (nem Payment.ReturnMessage, nem array de erros) —
                 // repassa o corpo bruto retornado pela Cielo para diagnóstico, em vez de
                 // adivinhar a causa. Ver também /painel/logs (LogCielo) para o histórico completo.
                 errorMsg = `Código HTTP ${resCielo.status}. Resposta Cielo: ${rawText.slice(0, 300) || '[vazia]'}`;
             }

             // CMS: reservation.error.<ReturnCode> — mensagem amigável editável pelo admin,
             // sem nomes fixos no código (ex: ReturnCode 129 = "Affiliation not found").
             errorMsg = await getReservationErrorMessage(returnCode, errorMsg);

             throw new Error("Transação Recusada pela Operadora: " + errorMsg);
         }

         cieloLog = "Sucesso Cartão Cielo: " + cieloResponseJson.Payment.ReturnMessage;
         paymentApproved = true;
         // Cartão cobrado agora pela Cielo (Capture:true) → XRS recebe prepaidMode="PP".
         capturedCreditCard = { number: cardNumClean, holderName: paymentData.creditCard.name, validity: validityFormatted, cardIssuer, captured: true };
         // Guarda o PaymentId da Cielo — necessário para estornar (void) se a reserva for cancelada depois.
         cieloPaymentId = cieloResponseJson.Payment.PaymentId;
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

        // Atributos de pagamento (prepaidMode/prepaidPercentage/prepaidAmount + meanOfPayment)
        // calculados uma vez e reaproveitados no getQuote (só o meanOfPayment importa lá,
        // para precificação de voucher) e no bookReservation final.
        const paymentAttrs = buildReservationPaymentAttrs({
          method: paymentData.method,
          captured: paymentData.method === 'PIX' || !!capturedCreditCard?.captured,
          amountBRL: (paymentData.amountInCents || 0) / 100,
          // Passa os dados do cartão para QUALQUER fluxo CREDIT (capturado ou não),
          // para que o paymentMapping envie o nó CC correto ao XRS.
          // Antes disso, a condição !capturedCreditCard?.captured excluía o cartão
          // exatamente quando captured=true, deixando o XRS sem meanOfPayment válido.
          creditCardGuarantee: (paymentData.method === 'CREDIT' && capturedCreditCard)
            ? { number: capturedCreditCard.number, holderName: capturedCreditCard.holderName, validity: capturedCreditCard.validity, cardIssuer: capturedCreditCard.cardIssuer }
            : undefined,
          voucherData: paymentData.method === 'VOUCHER' ? voucherData : undefined,
          contractID,
          carCategory,
          pickupDate,
          returnDate,
          merchantOrderId,
        });

        // rateId vem do getMultipleRates (Step 2) e é válido para a sessão.
        // ⚠️ O refresh via getQuote foi removido — adicionava 10-20s ao fluxo,
        // causando timeout no cliente APÓS a Cielo já ter capturado o pagamento.
        // Resultado: cliente cobrado sem reserva. O rateId do Step 2 é suficiente.

        const contractAttr = contractID ? ` contractID="${contractID}" type="C"` : '';

        // Build equipment XML — merge both sources into a Map to avoid duplicates.
        // bookingData.extras (Step 2 quick-add) and xrsEquipment (Step 3 detail selector)
        // can contain overlapping codes. We keep the highest qty per code.
        const equipmentMap = new Map<string, number>();
        const insuranceCodes = ['TPL','LDW','CDW','THW','SCDW','SPCDW','STHW','SPTHW','MEDIUM','PREMIUM','PREMPRE','PREMUP','RSA','APP','PAI','PEP','SLDW','WWI','SPAI'];

        // Source 1: bookingData.extras (non-insurance codes only)
        const extras = bookingData.extras || {};
        Object.entries(extras).forEach(([code, qty]: any) => {
          if (!insuranceCodes.includes(code) && qty > 0) {
            equipmentMap.set(code, Math.max(equipmentMap.get(code) || 0, qty));
          }
        });

        // Source 2: xrsEquipment from Step 3 — overwrites/updates qty for same code
        if (Array.isArray(xrsEquipment)) {
          xrsEquipment.forEach((eq: any) => {
            if (eq.code && eq.qty > 0) {
              equipmentMap.set(eq.code, Math.max(equipmentMap.get(eq.code) || 0, eq.qty));
            }
          });
        }

        const equipmentXml = [...equipmentMap.entries()]
          .map(([code, qty]) => `\n          <equipment code="${code}" qty="${qty}"/>`)
          .join('');

        const extraKeys = Object.keys(extras).filter(k => extras[k] > 0);

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

        const { loyaltyProgramId, loyaltyId } = customerData;
        let loyaltyXml = '';
        if (loyaltyProgramId && loyaltyId) {
          loyaltyXml = `\n        <loyaltyProgram programId="${loyaltyProgramId}" loyaltyID="${loyaltyId}"/>`;
        }

        const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${carCategory}" rateId="${rateId}"${paymentAttrs.prepaidAttrs}${contractAttr}${productDataAttr} preferredLanguage="pt_BR" email="${customerData.email.trim()}">
        <checkout stationID="${pickupStation}" date="${pickupDate}" time="${bookingData.pickupTime || '1000'}"/>
        <checkin stationID="${returnStation}" date="${returnDate}" time="${bookingData.returnTime || '1000'}"/>
        <equipmentList>${equipmentXml}</equipmentList>${insuranceXml ? `\n        <insuranceList>${insuranceXml}\n        </insuranceList>` : ''}${paymentAttrs.meanOfPaymentXml}${loyaltyXml}
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
          // Extrair mensagem de erro real retornada pelo XRS para diagnóstico
          const errNode = xrsResponse?.message?.serviceResponse?.errors
            || xrsResponse?.message?.errors
            || xrsResponse?.serviceResponse?.errors
            || xrsResponse?.errors;
          const errArr  = errNode ? (Array.isArray(errNode.error) ? errNode.error : [errNode.error]).filter(Boolean) : [];
          const xrsMsg  = errArr.map((e: any) => {
            const a = e.$ || e;
            return [a.errorCode, a.description || a.text || a.message].filter(Boolean).join(': ');
          }).join(' | ');
          const xrsStatusMsg = bookResNode?.$?.statusCode
            ? `XRS statusCode=${bookResNode.$.statusCode}`
            : '';
          const detail = [xrsMsg, xrsStatusMsg].filter(Boolean).join(' | ');
          throw new Error(`Europcar não retornou número de reserva.${detail ? ' Motivo: ' + detail : ' Verifique os logs XRS.'}`);
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
        // (segunda etapa do fluxo em duas etapas: bookReservation → createVoucher registra o
        // documento no GreenWay)
        if (resNumber && paymentData.method === 'VOUCHER' && voucherData?.type === 'EXO') {
          try {
            const voucherAmount = car.totalRateEstimate || car.total || '0';
            const voucherCurrency = car.bookingCurrencyOfTotalRateEstimate || car.currency || 'EUR';
            const createVoucherXml = buildCreateVoucherXml(resNumber, voucherData, voucherAmount, voucherCurrency);

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
                paymentId: pixData?.paymentId || cieloPaymentId,
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
        // Send HTML confirmation email with booking details
        try {
          const xrsInsArr: any[] = Array.isArray(xrsInsurances) ? xrsInsurances : [];
          const extrasMap = bookingData.extras || {};
          const extrasArr = Object.entries(extrasMap)
            .filter(([, v]: any) => v > 0)
            .map(([code, qty]: any) => {
              const qi = xrsInsArr.find((i: any) => i.code === code);
              return { code, name: qi?.name || code, qty, priceBRL: qi?.priceBRL || 0 };
            });

          sendBookingConfirmation({
            toEmail: customerData.email,
            customerName: `${customerData.nome} ${customerData.sobrenome}`,
            resNumber: finalResNumber,
            carName: bookingData.car?.carCategoryName || bookingData.car?.name || '',
            pickupStation: bookingData.pickupStation || '',
            returnStation: bookingData.returnStation || bookingData.pickupStation || '',
            pickupDate: bookingData.pickupDate || '',
            returnDate: bookingData.returnDate || '',
            paymentMethod: paymentData.method,
            totalBRL: (paymentData.amountInCents || 0) / 100,
            isOnRequest,
            xrsEquipment: Array.isArray(xrsEquipment) ? xrsEquipment : [],
            extras: extrasArr,
          });
        } catch (emailErr) {
          console.error('[reservas] Error sending booking confirmation:', emailErr);
        }
      }

      // 5. Auto-criação de conta para clientes sem login (guest checkout)
      // Cria uma conta se o e-mail informado ainda não existe no banco.
      // Nunca bloqueia a reserva — erros são apenas logados.
      let accountCreated = false;
      if (customerData.email?.trim()) {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: customerData.email.trim().toLowerCase() },
            select: { id: true },
          });

          if (!existingUser) {
            const tempPassword = generateTemporaryPassword();
            const hashedPassword = await bcrypt.hash(tempPassword, 10);
            const fullName = `${customerData.nome || ''} ${customerData.sobrenome || ''}`.trim();

            await prisma.user.create({
              data: {
                name: fullName,
                email: customerData.email.trim().toLowerCase(),
                password: hashedPassword,
                phone: customerData.telefone || null,
                cpf: customerData.cpf?.replace(/\D/g, '').slice(0, 11) || null,
                role: 'USER',
                status: 'ACTIVE',
              },
            });

            accountCreated = true;
            console.log(`[reservas] ✅ Conta criada automaticamente para ${customerData.email} (reserva ${finalResNumber})`);

            // Envia e-mail de boas-vindas com credenciais (não bloqueia em caso de falha)
            sendWelcomeWithCredentials({
              toEmail: customerData.email.trim(),
              firstName: customerData.nome || fullName,
              password: tempPassword,
              resNumber: finalResNumber || undefined,
            }).catch(err => console.error('[reservas] Falha ao enviar e-mail de boas-vindas:', err));
          }
        } catch (accountErr: any) {
          console.error('[reservas] Falha ao criar conta automática:', accountErr.message);
        }
      }

      return NextResponse.json({
         success: true,
         resNumber: finalResNumber,
         merchantOrderId: finalMerchantOrderId,
         pixData,
         onRequest: isOnRequest,
         onRequestItems,
         accountCreated,
         cieloLog: `${cieloLog} | ${logOrigem}`
      });

   } catch (error: any) {
      console.error(error);

      // ── AUTO-VOID: se a Cielo já cobrou mas o XRS falhou, estorna automaticamente ──
      // Evita que o cliente pague sem ter reserva criada.
      if (cieloPaymentId && cieloConfig?.merchantId && cieloConfig?.merchantKey) {
        try {
          console.warn(`[reservas] XRS falhou após cobrança Cielo (${cieloPaymentId}) — iniciando void automático.`);
          const voidResult = await voidCieloPayment(
            cieloPaymentId,
            cieloConfig.merchantId,
            cieloConfig.merchantKey,
            isSandboxMode
          );
          if (voidResult.voided) {
            console.log(`[reservas] ✅ Void automático bem-sucedido: PaymentId ${cieloPaymentId}`);
            error.message = error.message + ` | Cobrança estornada automaticamente (PaymentId: ${cieloPaymentId}).`;
          } else {
            console.error(`[reservas] ❌ Void automático FALHOU: ${voidResult.message} — PaymentId ${cieloPaymentId} precisa de estorno manual!`);
            error.message = error.message + ` | ATENÇÃO: estorno automático falhou — PaymentId ${cieloPaymentId} precisa ser estornado manualmente na Cielo.`;
          }
        } catch (voidErr: any) {
          console.error(`[reservas] ❌ Exceção no void automático — PaymentId ${cieloPaymentId} precisa de estorno manual:`, voidErr.message);
          error.message = error.message + ` | ATENÇÃO: estorno automático falhou — PaymentId ${cieloPaymentId} precisa ser estornado manualmente na Cielo.`;
        }
      }

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
