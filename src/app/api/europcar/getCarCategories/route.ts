import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime, contractID } = body;

    const contractAttr = contractID ? ` contractID="${contractID}" type="C"` : '';

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getCarCategories">
    <serviceParameters>
      <reservation${contractAttr}>
        <checkout stationID="${pickupStation}" date="${pickupDate}" time="${pickupTime || '1000'}"/>
        <checkin stationID="${returnStation || pickupStation}" date="${returnDate}" time="${returnTime || '1000'}"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`;

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
      password: process.env.XRS_PASSWORD || 'DEMO',
      action: 'getCarCategories',
      sourceFile: 'getCarCategories/route.ts'
    };

    const xrsResponse = await callXRS(xmlRequest, config);
    return NextResponse.json(xrsResponse);

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar XRS getCarCategories' },
      { status: 500 }
    );
  }
}
