import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import { isValidXRSDate, isValidXRSTime } from '@/lib/europcar/validate';
import { escapeXml } from '@/lib/europcar/xmlEscape';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pickupStation, returnStation, pickupDate, returnDate, pickupTime, returnTime, contractID } = body;

    if (!isValidXRSDate(pickupDate) || !isValidXRSDate(returnDate)) {
      return NextResponse.json({ error: 'Data inválida. Use o formato YYYYMMDD.' }, { status: 400 });
    }
    if ((pickupTime && !isValidXRSTime(pickupTime)) || (returnTime && !isValidXRSTime(returnTime))) {
      return NextResponse.json({ error: 'Horário inválido. Use o formato HHMM.' }, { status: 400 });
    }

    const contractAttr = contractID ? ` contractID="${escapeXml(contractID)}" type="C"` : '';

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getCarCategories">
    <serviceContext language="pt_PT"/>
    <serviceParameters>
      <reservation${contractAttr}>
        <checkout stationID="${escapeXml(pickupStation)}" date="${escapeXml(pickupDate)}" time="${escapeXml(pickupTime || '1000')}"/>
        <checkin stationID="${escapeXml(returnStation || pickupStation)}" date="${escapeXml(returnDate)}" time="${escapeXml(returnTime || '1000')}"/>
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
