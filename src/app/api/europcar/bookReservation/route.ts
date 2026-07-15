import { NextResponse } from 'next/server';
import { callXRS, DEFAULT_POA_CID } from '@/lib/europcar/xrsClient';
import prisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      carCategory, rateId,
      pickupStation, returnStation,
      pickupDate, returnDate,
      pickupTime, returnTime,
      driverData, paymentData, contractID,
      voucherData
    } = body;

    if (!carCategory || !rateId) {
      return NextResponse.json({ error: 'carCategory e rateId são obrigatórios' }, { status: 400 });
    }

    // Use POA CID as default when no contractID is provided
    const effectiveCID = contractID || DEFAULT_POA_CID;
    const contractAttr = ` contractID="${effectiveCID}" type="C"`;

    // CID to BA mapping for ETO vouchers (provided by Europcar)
    const cidToBa: Record<string, string> = {
      '56935466': '73675595',  // ETO Líquido (Excesso)
      '56935495': '73804373',  // ETO Internacional (Excesso Zero)
    };

    let meanOfPaymentXml = '';
    let isVoucherEXO = false;
    
    if (voucherData && voucherData.type === 'ETO') {
      const ba = cidToBa[effectiveCID] || voucherData.businessAccount || '';
      const d1 = new Date(parseInt(pickupDate.slice(0,4)), parseInt(pickupDate.slice(4,6))-1, parseInt(pickupDate.slice(6,8)));
      const d2 = new Date(parseInt(returnDate.slice(0,4)), parseInt(returnDate.slice(4,6))-1, parseInt(returnDate.slice(6,8)));
      const duration = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));

      const numericVoucherID = (voucherData?.id && /^\d+$/.test(voucherData.id)) ? voucherData.id : '1234';
      meanOfPaymentXml = `
        <meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${numericVoucherID}" 
                       businessAccount="${ba}" voucherCarCategory="${carCategory}" 
                       voucherRentalDuration="${duration}"/>`;
    } else if (voucherData && voucherData.type === 'EXO') {
      isVoucherEXO = true;
    }


    let loyaltyXml = '';
    if (driverData?.loyaltyProgramId && driverData?.loyaltyId) {
      loyaltyXml = `\n        <loyaltyProgram programId="${driverData.loyaltyProgramId}" loyaltyID="${driverData.loyaltyId}"/>`;
    }

    const prepaidModeAttr = (voucherData && voucherData.type === 'ETO') ? '' : ' prepaidMode="NP"';

    // Build equipment XML from extras (correct format: code/qty)
    let equipmentXml = '';
    const extras = body.extras || {};
    const extraKeys = Object.keys(extras).filter(k => extras[k] > 0);
    const insuranceCodes = ['TPL','LDW','CDW','THW','SCDW','SPCDW','STHW','SPTHW','MEDIUM','PREMIUM','PREMPRE','PREMUP','RSA','APP','PAI','PEP'];
    const equipmentKeys = extraKeys.filter(k => !insuranceCodes.includes(k));
    if (equipmentKeys.length > 0) {
      equipmentXml = equipmentKeys.map(k => `\n          <equipment code="${k}" qty="${extras[k]}"/>`).join('');
    }

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${carCategory}" rateId="${rateId}" chargesDetail="TRE"${prepaidModeAttr}${contractAttr} email="${driverData?.email || ''}">
        <checkout stationID="${pickupStation}" date="${pickupDate}" time="${pickupTime || '1000'}"/>
        <checkin stationID="${returnStation || pickupStation}" date="${returnDate}" time="${returnTime || '1000'}"/>
        <equipmentList>${equipmentXml}</equipmentList>${meanOfPaymentXml}${loyaltyXml}
      </reservation>
      <driver countryOfResidence="BR"
              firstName="${driverData?.firstName || 'Test'}"
              lastName="${driverData?.lastName || 'Client'}"
              title="${driverData?.title || 'MR'}"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
      password: process.env.XRS_PASSWORD || 'DEMO',
      action: 'bookReservation',
      sourceFile: 'bookReservation/route.ts'
    };

    const xrsResponse = await callXRS(xmlRequest, config);

    // Extract reservation number from response
    const resNumber =
      xrsResponse?.message?.serviceResponse?.reservation?.$?.resNumber ||
      xrsResponse?.serviceResponse?.reservation?.$?.resNumber ||
      null;

    if (resNumber) {
      try {
        const dFirstName = driverData?.firstName || 'Test';
        const dLastName = driverData?.lastName || 'Client';
        const dEmail = driverData?.email || '';
        const dPhone = driverData?.telefone || driverData?.phone || '';
        const dCpf = (driverData?.cpf || driverData?.document || '').replace(/\D/g, '').slice(0, 11);
        const dCountry = driverData?.paisEmissao || 'BR';

        // Build licenseList XML if CNH data is available
        let licenseListXml = '';
        if (driverData?.cnhNumero || driverData?.cnhValidade) {
          let expirationDate = '';
          if (driverData?.cnhValidade) {
            const parts = driverData.cnhValidade.replace(/\D/g, '/').split('/');
            if (parts.length === 2) {
              const [mm, yyyy] = parts;
              const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
              expirationDate = `${year}${mm.padStart(2, '0')}01`;
            }
          }
          licenseListXml = `
        <licenseList>
          <license licenseNumber="${driverData.cnhNumero || ''}"${expirationDate ? ` expirationDate="${expirationDate}"` : ''}${driverData.cnhCidade ? ` cityOfIssuance="${driverData.cnhCidade}"` : ''} countryOfIssuance="${dCountry}"/>
        </licenseList>`;
        }

        const createDriverXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="createDriver">
    <serviceParameters>
      <reservation resNumber="${resNumber}"/>
      <driver isoLanguage="pt_BR" firstName="${dFirstName}" lastName="${dLastName}" title="${driverData?.title || 'MR'}">
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
          sourceFile: 'bookReservation/route.ts'
        });
        console.log(`[bookReservation] createDriver enviado com sucesso para a reserva ${resNumber}`);
      } catch (driverErr: any) {
        console.error(`[bookReservation] Erro ao criar driver para ${resNumber}:`, driverErr.message);
      }
    }

    if (resNumber && isVoucherEXO) {
      try {
        const voucherAmount = body.car?.totalRateEstimate || body.car?.total || '0';
        const voucherCurrency = body.car?.bookingCurrencyOfTotalRateEstimate || body.car?.currency || 'EUR';
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
          sourceFile: 'bookReservation/route.ts'
        });
        console.log(`[bookReservation] createVoucher (EXO) enviado com sucesso para a reserva ${resNumber}`);
      } catch (voucherErr: any) {
        console.error(`[bookReservation] Erro ao criar voucher EXO para ${resNumber}:`, voucherErr.message);
      }
    }

    // Save local reservation record
    if (paymentData) {
      await prisma.localReservation.create({
        data: {
          resNumber: resNumber || `LOCAL_${Date.now()}`,
          merchantOrderId: paymentData.merchantOrderId || `ORDER_${Date.now()}`,
          customerData: JSON.stringify({
            ...driverData,
            contractID: contractID || null,
            carCategory,
          }),
          status: paymentData.paid ? 'CONFIRMED_PREPAID' : 'CONFIRMED_NON_PREPAID'
        }
      });
    }

    return NextResponse.json({
      success: true,
      resNumber,
      raw: xrsResponse
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar XRS bookReservation' },
      { status: 500 }
    );
  }
}
