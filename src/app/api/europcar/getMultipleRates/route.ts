import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime, acrissCodes, contractID } = body;

    if (!acrissCodes || !Array.isArray(acrissCodes)) {
      return NextResponse.json({ error: 'acrissCodes precisa ser um array' }, { status: 400 });
    }

    // Split into chunks of 10 (XRS limit per request)
    const chunks: string[][] = [];
    for (let i = 0; i < acrissCodes.length; i += 10) {
      chunks.push(acrissCodes.slice(i, i + 10));
    }

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
      password: process.env.XRS_PASSWORD || 'DEMO',
      action: 'getMultipleRates',
      sourceFile: 'getMultipleRates/route.ts'
    };

    // Build contractID attribute if promotion is active
    const contractAttr = contractID ? ` contractID="${contractID}" type="C"` : '';

    const promises = chunks.map(chunk => {
      const carCategoryPattern = chunk.join('');

      const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getMultipleRates">
    <serviceContext language="pt_PT"/>
    <serviceParameters>
      <reservation carCategoryPattern="${carCategoryPattern}" rateDetails="Y" chargesDetail="TRE"${contractAttr}>
        <checkout stationID="${pickupStation}" date="${pickupDate}" time="${pickupTime || '1000'}"/>
        <checkin stationID="${returnStation || pickupStation}" date="${returnDate}" time="${returnTime || '1000'}"/>
      </reservation>
      <driver countryOfResidence="BR" />
    </serviceParameters>
  </serviceRequest>
</message>`;

      return callXRS(xmlRequest, config);
    });

    const results = await Promise.all(promises);

    return NextResponse.json({ results });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar XRS getMultipleRates' },
      { status: 500 }
    );
  }
}
