import { callXRS, DEFAULT_POA_CID } from '@/lib/europcar/xrsClient';

const CID_TO_BA: Record<string, string> = {
  '56935466': '73675595',  // ETO Líquido (Excesso)
  '56935495': '73804373',  // ETO Internacional (Excesso Zero)
};

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

  // Refresh rateId via getQuote
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

  const contractAttr = contractID ? ` contractID="${contractID}" type="C"` : '';

  let equipmentXml = '';
  const extras = bookingData.extras || {};
  const extraKeys = Object.keys(extras).filter(k => extras[k] > 0);
  const insuranceCodes = ['TPL','LDW','CDW','THW','SCDW','SPCDW','STHW','SPTHW','MEDIUM','PREMIUM','PREMPRE','PREMUP','RSA','APP','PAI','PEP','SLDW','WWI','SPAI'];
  const equipmentKeys = extraKeys.filter(k => !insuranceCodes.includes(k));
  if (equipmentKeys.length > 0) {
    equipmentXml = equipmentKeys.map(k => `\n          <equipment code="${k}" qty="${extras[k]}"/>`).join('');
  }

  if (Array.isArray(xrsEquipment) && xrsEquipment.length > 0) {
    equipmentXml += xrsEquipment
      .filter((eq: any) => eq.code && eq.qty > 0)
      .map((eq: any) => `\n          <equipment code="${eq.code}" qty="${eq.qty}"/>`)
      .join('');
  }

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
  } else if (paymentData.method === 'PIX' || paymentData.method === 'CREDIT' || paymentData.method === 'BALCAO') {
      // In PIX or Balcao, it's prepaid locally (or paid at counter), but we send no voucher to Europcar.
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

  const xrsResponse = await callXRS(xmlRequest, {
    callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
    password: process.env.XRS_PASSWORD || 'DEMO',
    action: 'bookReservation',
    sourceFile: 'bookXRS.ts'
  });
  
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
        sourceFile: 'bookXRS.ts'
      });
      console.log(`[xrsBook] createDriver enviado com sucesso para a reserva ${resNumber}`);
    } catch (driverErr: any) {
      console.error(`[xrsBook] Erro ao criar driver para ${resNumber}:`, driverErr.message);
    }
  }

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
        sourceFile: 'bookXRS.ts'
      });
      console.log(`[xrsBook] createVoucher (EXO) enviado com sucesso para a reserva ${resNumber}`);
    } catch (voucherErr: any) {
      console.error(`[xrsBook] Erro ao criar voucher EXO para ${resNumber}:`, voucherErr.message);
    }
  }

  return { resNumber, isOnRequest, onRequestItems };
}
