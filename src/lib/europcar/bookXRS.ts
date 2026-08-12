import { callXRS, DEFAULT_POA_CID } from '@/lib/europcar/xrsClient';
import { buildReservationPaymentAttrs, buildCreateVoucherXml } from '@/lib/europcar/paymentMapping';
import { escapeXml } from '@/lib/europcar/xmlEscape';
import { parsePayerList } from '@/lib/europcar/parsePayerList';

export interface BookXRSParams {
  bookingData: any;
  customerData: any;
  paymentData: any;
  voucherData?: any;
  xrsEquipment?: any[];
  xrsInsurances?: any[];
}

export async function executeXRSBooking({ bookingData, customerData, paymentData, voucherData, xrsEquipment, xrsInsurances }: BookXRSParams) {
  let resNumber: string | null = null;
  let isOnRequest = false;
  let onRequestItems: any[] = [];

  const car = bookingData.car || {};
  const pickupDate = bookingData.pickupDate;
  const returnDate = bookingData.returnDate;
  const pickupStation = bookingData.pickupStation;
  const returnStation = bookingData.returnStation || pickupStation;
  const contractID = bookingData.contractID || DEFAULT_POA_CID;
  const carCategory = car.carCategoryCode;
  let rateId = car.rateId;
  let productDataAttr = '';

  // Pagamento já capturado pela Cielo antes desta função ser chamada (PIX confirmado,
  // ou reprocessamento de CREDIT) → prepaidMode="PP" com valor e percentual quitados.
  const paymentAttrs = buildReservationPaymentAttrs({
    method: paymentData.method,
    captured: paymentData.method === 'PIX' || paymentData.method === 'CREDIT',
    amountBRL: (paymentData.amountInCents || 0) / 100,
    voucherData: paymentData.method === 'VOUCHER' ? voucherData : undefined,
    contractID,
    carCategory,
    pickupDate,
    returnDate,
    merchantOrderId: paymentData.merchantOrderId,
  });

  // Refresh rateId via getQuote
  try {
    const quoteXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
<serviceRequest serviceCode="getQuote">
<serviceParameters>
  <reservation carCategory="${escapeXml(carCategory)}"${contractID ? ` contractID="${escapeXml(contractID)}" type="C"` : ''} chargesDetail="TRE" rateId="${escapeXml(rateId)}">
    <checkout stationID="${escapeXml(pickupStation)}" date="${escapeXml(pickupDate)}" time="${escapeXml(bookingData.pickupTime || '1000')}"/>
    <checkin stationID="${escapeXml(returnStation)}" date="${escapeXml(returnDate)}" time="${escapeXml(bookingData.returnTime || '1000')}"/>
    ${paymentAttrs.meanOfPaymentXml}
  </reservation>
  <driver countryOfResidence="BR"/>
</serviceParameters>
</serviceRequest>
</message>`;

    const quoteRes = await callXRS(quoteXml, {
      callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
      password: process.env.XRS_PASSWORD || 'DEMO',
      action: 'getQuote',
      sourceFile: 'bookXRS.ts'
    });
    
    const resNode = quoteRes?.message?.serviceResponse?.reservation?.$ || quoteRes?.serviceResponse?.reservation?.$;
    if (resNode?.rateId) rateId = resNode.rateId;
    
    if (resNode?.productCode) productDataAttr += ` productCode="${resNode.productCode}"`;
    if (resNode?.productFamily) productDataAttr += ` productFamily="${resNode.productFamily}"`;
    if (resNode?.productVersion) productDataAttr += ` productVersion="${resNode.productVersion}"`;
  } catch (quoteErr: any) {
    console.warn('[xrsBook] Erro no refresh do rateId:', quoteErr.message);
  }

  const contractAttr = contractID ? ` contractID="${escapeXml(contractID)}" type="C"` : '';

  let equipmentXml = '';
  const extras = bookingData.extras || {};
  const extraKeys = Object.keys(extras).filter(k => extras[k] > 0);
  const insuranceCodes = ['TPL','LDW','CDW','THW','SCDW','SPCDW','STHW','SPTHW','MEDIUM','PREMIUM','PREMPRE','PREMUP','RSA','APP','PAI','PEP','SLDW','WWI','SPAI'];
  const equipmentKeys = extraKeys.filter(k => !insuranceCodes.includes(k));
  if (equipmentKeys.length > 0) {
    equipmentXml = equipmentKeys.map(k => `\n          <equipment code="${escapeXml(k)}" qty="${escapeXml(extras[k])}"/>`).join('');
  }

  if (Array.isArray(xrsEquipment) && xrsEquipment.length > 0) {
    equipmentXml += xrsEquipment
      .filter((eq: any) => eq.code && eq.qty > 0)
      .map((eq: any) => `\n          <equipment code="${escapeXml(eq.code)}" qty="${escapeXml(eq.qty)}"/>`)
      .join('');
  }

  let insuranceXml = '';
  const selectedInsKeys = extraKeys.filter(k => insuranceCodes.includes(k));
  const allInsCodes = new Set<string>([
    ...selectedInsKeys,
    ...(Array.isArray(xrsInsurances) ? xrsInsurances.map((ins: any) => ins.code || ins).filter(Boolean) : []),
  ]);
  if (allInsCodes.size > 0) {
    insuranceXml = [...allInsCodes].map(code => `\n          <insurance code="${escapeXml(code)}"/>`).join('');
  }

  const { loyaltyProgramId, loyaltyId } = customerData;
  let loyaltyXml = '';
  if (loyaltyProgramId && loyaltyId) {
    loyaltyXml = `\n        <loyaltyProgram programId="${escapeXml(loyaltyProgramId)}" loyaltyID="${escapeXml(loyaltyId)}"/>`;
  }

  const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
<serviceRequest serviceCode="bookReservation">
<serviceParameters>
  <reservation carCategory="${escapeXml(carCategory)}" rateId="${escapeXml(rateId)}"${paymentAttrs.prepaidAttrs}${contractAttr}${productDataAttr} chargesDetail="TRE" preferredLanguage="pt_BR" email="${escapeXml(customerData.email.trim())}">
    <checkout stationID="${escapeXml(pickupStation)}" date="${escapeXml(pickupDate)}" time="${escapeXml(bookingData.pickupTime || '1000')}"/>
    <checkin stationID="${escapeXml(returnStation)}" date="${escapeXml(returnDate)}" time="${escapeXml(bookingData.returnTime || '1000')}"/>
    <equipmentList>${equipmentXml}</equipmentList>${insuranceXml ? `\n        <insuranceList>${insuranceXml}\n        </insuranceList>` : ''}${paymentAttrs.meanOfPaymentXml}${loyaltyXml}
  </reservation>
  <driver countryOfResidence="BR"
          firstName="${escapeXml(customerData.nome.trim())}"
          lastName="${escapeXml(customerData.sobrenome.trim())}"
          title="MR"/>
</serviceParameters>
</serviceRequest>
</message>`;

  const xrsResponse = await callXRS(xmlRequest, {
    callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
    password: process.env.XRS_PASSWORD || 'DEMO',
    action: 'bookReservation',
    sourceFile: 'bookXRS.ts'
  });
  
  const bookResNode = xrsResponse?.message?.serviceResponse?.reservation || xrsResponse?.serviceResponse?.reservation;
  resNumber = bookResNode?.$?.resNumber || null;

  // ── Log do payerList retornado pelo bookReservation (confirma split no GW) ──
  // Com chargesDetail="TRE" na reserva, o GW devolve o split driver/BA confirmado.
  // Este log é a prova de que o GreenWay registrou os valores corretamente.
  const bookPayerSplit = parsePayerList(bookResNode);
  if (bookPayerSplit) {
    console.log(`[xrsBook] ✅ GW split confirmado: driver=€${bookPayerSplit.driverDueXRS} (BRL: ${bookPayerSplit.driverDueBRL}), BA=BRL ${bookPayerSplit.businessDueBRL}`);
  } else {
    console.warn('[xrsBook] ⚠️ GW não retornou payerList no bookReservation — verificar se chargesDetail=TRE foi aceito');
  }

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
      const dCpf = (customerData.cpf || '').replace(/\D/g, '').slice(0, 11);
      const dCountry = customerData.paisEmissao || bookingData?.country || 'BR';

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
    <license licenseNumber="${escapeXml(customerData.cnhNumero || '')}"${expirationDate ? ` expirationDate="${escapeXml(expirationDate)}"` : ''}${customerData.cnhCidade ? ` cityOfIssuance="${escapeXml(customerData.cnhCidade)}"` : ''} countryOfIssuance="${escapeXml(dCountry)}"/>
  </licenseList>`;
      }

      const createDriverXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
<serviceRequest serviceCode="createDriver">
<serviceParameters>
  <reservation resNumber="${escapeXml(resNumber)}"/>
  <driver isoLanguage="pt_BR" firstName="${escapeXml(dFirstName)}" lastName="${escapeXml(dLastName)}" title="MR">
    <addressList>
      <address addressType="P" addressKind="D" addressCountry="${escapeXml(dCountry)}">
        <emails>
          <email emailAddress="${escapeXml(dEmail)}" type="M"/>
        </emails>
        <phones>
          <phone phoneNumber="${escapeXml(dPhone)}" phoneType="M"/>
        </phones>
      </address>
    </addressList>
    <legalIdList>
      <legalId idTy="P" docNumber="${escapeXml(dCpf)}" country="${escapeXml(dCountry)}"/>
    </legalIdList>${licenseListXml}
  </driver>
</serviceParameters>
</serviceRequest>
</message>`;

      await callXRS(createDriverXml, {
        callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
        password: process.env.XRS_PASSWORD || 'DEMO',
        action: 'createDriver',
        sourceFile: 'bookXRS.ts'
      });
      console.log(`[xrsBook] createDriver enviado com sucesso para a reserva ${resNumber}`);
    } catch (driverErr: any) {
      console.error(`[xrsBook] Erro ao criar driver para ${resNumber}:`, driverErr.message);
    }
  }

  const isPrepaidOnline = paymentData.method === 'PIX' || paymentData.method === 'CREDIT';
  const isOnlineEXO = isPrepaidOnline && contractID !== '56935466' && contractID !== '56935495';
  const isManualEXO = paymentData.method === 'VOUCHER' && voucherData?.type === 'EXO';

  if (resNumber && (isManualEXO || isOnlineEXO)) {
    try {
      const voucherAmount = car.totalRateEstimate || car.total || '0';
      const voucherCurrency = car.bookingCurrencyOfTotalRateEstimate || car.currency || 'EUR';
      const vData = isManualEXO ? voucherData : { type: 'EXO', iataNumber: '02170722' };
      const createVoucherXml = buildCreateVoucherXml(resNumber, vData, voucherAmount, voucherCurrency);

      await callXRS(createVoucherXml, {
        callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
        password: process.env.XRS_PASSWORD || 'DEMO',
        action: 'createVoucher',
        sourceFile: 'bookXRS.ts'
      });
      console.log(`[xrsBook] createVoucher (EXO) enviado com sucesso para a reserva ${resNumber}`);
    } catch (voucherErr: any) {
      console.error(`[xrsBook] Erro ao criar voucher EXO para ${resNumber}:`, voucherErr.message);
    }
  }

  return { resNumber, isOnRequest, onRequestItems };
}
