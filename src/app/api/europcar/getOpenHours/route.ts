import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import { escapeXml } from '@/lib/europcar/xmlEscape';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { stationCode, date, time } = body;

    if (!stationCode || !date || !time) {
      return NextResponse.json({ error: 'Parâmetros stationCode, date e time são obrigatórios.' }, { status: 400 });
    }

    const xmlRequest = `
      <?xml version="1.0" encoding="UTF-8"?>
      <Request>
        <Station>
           <StationCode>${escapeXml(stationCode)}</StationCode>
        </Station>
        <Date>${escapeXml(date)}</Date>
        <Time>${escapeXml(time)}</Time>
        <Action>getOpenHours</Action>
      </Request>
    `.trim();

    // Na arquitetura real, o DB alimentaria isso via Prisma XRSConfig
    const mockConfig = { callerCode: process.env.XRS_CALLER_CODE || 'DEMO', password: process.env.XRS_PASSWORD || 'DEMO', action: 'getOpenHours', sourceFile: 'getOpenHours/route.ts' };

    const xrsResponse = await callXRS(xmlRequest, mockConfig);

    return NextResponse.json(xrsResponse);

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar XRS getOpenHours' },
      { status: 500 }
    );
  }
}
