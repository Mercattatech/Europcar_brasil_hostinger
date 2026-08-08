import { NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';
import { isValidXRSDate, isValidXRSTime } from '@/lib/europcar/validate';
import { escapeXml } from '@/lib/europcar/xmlEscape';
export const dynamic = 'force-dynamic';

/**
 * POST /api/europcar/getQuote
 *
 * Body:
 *   carCategory    — ACRISS code (required)
 *   rateId         — optional rate ID
 *   pickupStation  — stationID
 *   returnStation  — stationID (falls back to pickupStation)
 *   pickupDate     — YYYYMMDD
 *   returnDate     — YYYYMMDD
 *   pickupTime     — HHMM (default: 1000)
 *   returnTime     — HHMM (default: 1000)
 *   contractID     — optional promotion CID
 *   prepaidMode    — "NP" (Pay on Arrival) | "PP" (Prepaid). Default: "NP"
 *                    Controls which price lines are returned for equipment.
 *   chargesDetail  — always sent as "TRE" (Total, Rental, Equipment)
 *   equipmentList  — [{ code, qty }] optional
 *   insuranceList  — [{ code }] optional
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      carCategory,
      rateId,
      pickupStation,
      returnStation,
      pickupDate,
      returnDate,
      pickupTime,
      returnTime,
      contractID,
      prepaidMode,    // "NP" | "PP"
      equipmentList,  // Array of { code, qty } — optional
      insuranceList,  // Array of { code } — optional
    } = body;

    if (!carCategory) {
      return NextResponse.json({ error: 'carCategory é obrigatório' }, { status: 400 });
    }
    if (!isValidXRSDate(pickupDate) || !isValidXRSDate(returnDate)) {
      return NextResponse.json({ error: 'Data inválida. Use o formato YYYYMMDD.' }, { status: 400 });
    }
    if ((pickupTime && !isValidXRSTime(pickupTime)) || (returnTime && !isValidXRSTime(returnTime))) {
      return NextResponse.json({ error: 'Horário inválido. Use o formato HHMM.' }, { status: 400 });
    }

    // Resolve prepaidMode — default to NP (Pay on Arrival / POA tariff)
    const resolvedPrepaidMode = prepaidMode === 'PP' ? 'PP' : 'NP';

    // Build optional attributes
    const contractAttr = contractID ? ` contractID="${escapeXml(contractID)}" type="C"` : '';
    const rateIdAttr   = rateId     ? ` rateId="${escapeXml(rateId)}"`               : '';

    // Build equipment XML
    let equipmentXml = '';
    if (equipmentList && Array.isArray(equipmentList) && equipmentList.length > 0) {
      const items = equipmentList
        .filter((eq: any) => eq.code && eq.qty > 0)
        .map((eq: any) => `          <equipment code="${escapeXml(eq.code)}" qty="${escapeXml(eq.qty)}"/>`)
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
        .map((ins: any) => `          <insurance code="${escapeXml(ins.code)}"/>`)
        .join('\n');
      if (items) {
        insuranceXml = `\n        <insuranceList>\n${items}\n        </insuranceList>`;
      }
    }

    // chargesDetail="TRE" is mandatory — ensures Total, Rental and Equipment breakdown
    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getQuote">
    <serviceContext language="pt_PT"/>
    <caller/>
    <serviceParameters>
      <reservation chargesDetail="TRE" rateDetails="Y" prepaidMode="${resolvedPrepaidMode}" carCategory="${escapeXml(carCategory)}"${contractAttr}${rateIdAttr}>
        <checkout stationID="${escapeXml(pickupStation)}" date="${escapeXml(pickupDate)}" time="${escapeXml(pickupTime || '1000')}"/>
        <checkin stationID="${escapeXml(returnStation || pickupStation)}" date="${escapeXml(returnDate)}" time="${escapeXml(returnTime || '1000')}"/>${equipmentXml}${insuranceXml}
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

    const config = {
      callerCode: process.env.XRS_CALLER_CODE || 'DEMO',
      password:   process.env.XRS_PASSWORD    || 'DEMO',
      action:     'getQuote',
      sourceFile: 'getQuote/route.ts',
    };

    const xrsResponse = await callXRS(xmlRequest, config);
    // Attach the resolved prepaidMode to the response so the frontend can track it
    return NextResponse.json({ ...xrsResponse, _prepaidMode: resolvedPrepaidMode });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao consultar XRS getQuote' },
      { status: 500 }
    );
  }
}
