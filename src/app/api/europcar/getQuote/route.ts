import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { carCategory, rateId, pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime, contractID } = body;

    if (!carCategory) {
      return NextResponse.json({ error: 'carCategory é obrigatório' }, { status: 400 });
    }

    // Build contractID attribute if promotion is active
    const contractAttr = contractID ? ` contractID="${contractID}" type="C"` : '';
    const rateIdAttr = rateId ? ` rateId="${rateId}"` : '';

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getQuote">
    <caller/>
    <serviceParameters>
      <reservation chargesDetail="TRE" rateDetails="Y" prepaidMode="NP" carCategory="${carCategory}"${contractAttr}${rateIdAttr}>
        <checkout stationID="${pickupStation}" date="${pickupDate}" time="${pickupTime || '1000'}"/>
        <checkin stationID="${returnStation || pickupStation}" date="${returnDate}" time="${returnTime || '1000'}"/>
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
