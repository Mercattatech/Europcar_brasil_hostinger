import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      carCategory, rateId, pickupStation, returnStation,
      pickupDate, returnDate, pickupTime, returnTime,
      contractID,
      equipmentList,  // Array of { code, qty } — optional
      insuranceList,  // Array of { code } — optional
    } = body;

    if (!carCategory) {
      return NextResponse.json({ error: 'carCategory é obrigatório' }, { status: 400 });
    }

    // Build contractID attribute if promotion is active
    const contractAttr = contractID ? ` contractID="${contractID}" type="C"` : '';
    const rateIdAttr = rateId ? ` rateId="${rateId}"` : '';

    // Build equipment XML
    let equipmentXml = '';
    if (equipmentList && Array.isArray(equipmentList) && equipmentList.length > 0) {
      const items = equipmentList
        .filter((eq: any) => eq.code && eq.qty > 0)
        .map((eq: any) => `          <equipment code="${eq.code}" qty="${eq.qty}"/>`)
        .join('\n');
      if (items) {
        equipmentXml = `\n        <equipmentList>\n${items}\n        </equipmentList>`;
      }
    }

    // Build insurance XML
    let insuranceXml = '';
    if (insuranceList && Array.isArray(insuranceList) && insuranceList.length > 0) {
      const items = insuranceList
        .filter((ins: any) => ins.code)
        .map((ins: any) => `          <insurance code="${ins.code}"/>`)
        .join('\n');
      if (items) {
        insuranceXml = `\n        <insuranceList>\n${items}\n        </insuranceList>`;
      }
    }

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getQuote">
    <caller/>
    <serviceParameters>
      <reservation chargesDetail="TRE" rateDetails="Y" prepaidMode="NP" carCategory="${carCategory}"${contractAttr}${rateIdAttr}>
        <checkout stationID="${pickupStation}" date="${pickupDate}" time="${pickupTime || '1000'}"/>
        <checkin stationID="${returnStation || pickupStation}" date="${returnDate}" time="${returnTime || '1000'}"/>${equipmentXml}${insuranceXml}
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
      password: process.env.XRS_PASSWORD || 'DEMO',
      action: 'getQuote',
      sourceFile: 'getQuote/route.ts'
    };

    const xrsResponse = await callXRS(xmlRequest, config);
    return NextResponse.json(xrsResponse);

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar XRS getQuote' },
      { status: 500 }
    );
  }
}
