/**
 * GET /api/admin/test-cid?station=LIST01&dateFrom=20261129&dateTo=20261130&category=CCAR
 * Compares airport surcharge for multiple CIDs — admin only, temporary.
 */
import { NextRequest, NextResponse } from 'next/server';
import { callXRS } from '@/lib/europcar/xrsClient';

const CIDS_TO_TEST = [
  { label: 'ETO Liquido (atual)',  cid: '56935466', mode: 'PP' },
  { label: 'POA Publico',          cid: '57269673', mode: 'NP' },
  { label: 'Novo CID 47960004 PP', cid: '47960004', mode: 'PP' },
  { label: 'Novo CID 47960004 NP', cid: '47960004', mode: 'NP' },
];

function buildXml(category: string, station: string, dateFrom: string, dateTo: string, cid: string, mode: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getQuote">
    <serviceContext language="pt_PT"/>
    <caller/>
    <serviceParameters>
      <reservation chargesDetail="TRE" rateDetails="Y" prepaidMode="${mode}" carCategory="${category}" contractID="${cid}" type="C">
        <checkout stationID="${station}" date="${dateFrom}" time="1000"/>
        <checkin stationID="${station}" date="${dateTo}" time="1000"/>
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`;
}

function extractInfo(data: any) {
  const reservation = data?.message?.serviceResponse?.reservation;
  const quote = reservation?.quote;
  const qAttrs = quote?.$ || {};
  const svcAttrs = data?.message?.serviceResponse?.$ || {};

  const rawCharge = quote?.chargeList?.chargeLine;
  const chargeArr = rawCharge ? (Array.isArray(rawCharge) ? rawCharge : [rawCharge]) : [];

  let vatPct = 0, airportPrice = 0, airportBRL = 0, airportChrgPct = 0;
  chargeArr.forEach((c: any) => {
    const a = c.$ || c;
    if (a.chrgTy === '00028') vatPct = parseFloat(a.chrgPct || '0');
    if (a.chrgTy === '00024') {
      airportPrice    = parseFloat(a.price || '0');
      airportBRL      = parseFloat(a.priceInBookingCurrency || '0');
      airportChrgPct  = parseFloat(a.chrgPct || '0');
    }
  });

  const vatMult = vatPct > 0 ? 1 + vatPct / 100 : 1;
  const errorCode = svcAttrs.errorCode || '';

  return {
    errorCode,
    exchangeRate:           parseFloat(qAttrs.exchangeRate || '0'),
    vatPct,
    airportChrgPct,
    airportEUR_preVAT:      +airportPrice.toFixed(4),
    airportBRL_preVAT:      +airportBRL.toFixed(2),
    airportEUR_withVAT:     +(airportPrice * vatMult).toFixed(4),
    airportBRL_withVAT:     +(airportBRL   * vatMult).toFixed(2),
    totalRateEstimate:      parseFloat(qAttrs.totalRateEstimate || '0'),
    totalBRL:               parseFloat(qAttrs.totalRateEstimateInBookingCurrency || '0'),
    isPrepaid:              qAttrs.isPrepaid,
    carCategory:            reservation?.carCategory || qAttrs.carCategory,
    productCode:            reservation?.productCode || qAttrs.productCode,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const station  = sp.get('station')  || 'LIST01';
  const dateFrom = sp.get('dateFrom') || '20261129';
  const dateTo   = sp.get('dateTo')   || '20261130';
  const category = sp.get('category') || 'CCAR';

  const config = {
    callerCode: process.env.XRS_CALLER_CODE || '',
    password:   process.env.XRS_PASSWORD    || '',
    action:     'getQuote',
    sourceFile: 'admin/test-cid',
  };

  const results: any[] = [];

  for (const { label, cid, mode } of CIDS_TO_TEST) {
    try {
      const xml  = buildXml(category, station, dateFrom, dateTo, cid, mode);
      const data = await callXRS(xml, config);
      const info = extractInfo(data);
      results.push({ label, cid, mode, ...info });
    } catch (err: any) {
      results.push({ label, cid, mode, errorCode: err.message });
    }
  }

  // Return HTML for easy browser viewing
  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Teste CID — Aeroporto</title>
<style>
  body { font-family: monospace; background:#111; color:#eee; padding:2rem; }
  h1 { color:#f5a623; }
  table { border-collapse:collapse; width:100%; margin-top:1rem; }
  th { background:#333; color:#f5a623; padding:8px 12px; text-align:left; }
  td { border-top:1px solid #333; padding:8px 12px; }
  .match { color:#4caf50; font-weight:bold; }
  .err   { color:#f44336; }
  .label { color:#90caf9; font-weight:bold; }
  .alvo  { color:#ffeb3b; }
</style></head><body>
<h1>🔍 Teste CID — Sobretaxa de Aeroporto</h1>
<p>Station: <b>${station}</b> | ${dateFrom}→${dateTo} | Categoria: <b>${category}</b></p>
<p class="alvo">🎯 Alvo B2B Europcar: aeroporto = <b>14,22 BRL</b> (VAT incl.) | Total = <b>136,19 BRL</b></p>
<table>
<tr>
  <th>Contrato</th><th>CID</th><th>Mode</th><th>Erro</th>
  <th>Câmbio</th><th>IVA%</th><th>chrgPct%</th>
  <th>Aerop. BRL pré-IVA</th><th>Aerop. BRL c/IVA</th>
  <th>Total EUR</th><th>Total BRL</th><th>isPrepaid</th><th>Match?</th>
</tr>
${results.map(r => {
  const match = !r.errorCode && Math.abs(r.airportBRL_withVAT - 14.22) < 0.10;
  return `<tr>
    <td class="label">${r.label}</td>
    <td>${r.cid}</td><td>${r.mode}</td>
    <td class="${r.errorCode ? 'err' : ''}">${r.errorCode || '—'}</td>
    <td>${r.exchangeRate}</td><td>${r.vatPct}%</td><td>${r.airportChrgPct}%</td>
    <td>${r.airportBRL_preVAT}</td>
    <td><b>${r.airportBRL_withVAT}</b></td>
    <td>${r.totalRateEstimate}</td><td>${r.totalBRL}</td>
    <td>${r.isPrepaid ?? '—'}</td>
    <td class="${match ? 'match' : 'err'}">${match ? '✅ BATE!' : r.errorCode ? '❌ Erro' : `❌ diff ${(r.airportBRL_withVAT - 14.22).toFixed(2)}`}</td>
  </tr>`;
}).join('')}
</table>
<br><small>Gerado em ${new Date().toISOString()}</small>
</body></html>`;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}
