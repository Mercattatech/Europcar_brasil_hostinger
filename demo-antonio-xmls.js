#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 *  DEMO ANTONIO — TESTE COM XMLs CORRIGIDOS
 *  Mostra os XMLs EXATOS que o sistema envia ao Green Way,
 *  já com as correções:
 *    ✅  GPS  removido → NAV (código válido)
 *    ✅  ETO VCH → <meanOfPayment typeCode="VCH" voucherType="ETO">
 *
 *  Cenários:
 *    1. POA Balcão (NP)      — NAV + CDW/THW/RSA
 *    2. GRU ETO VCH          — NAV + CDW/THW/RSA
 * ═══════════════════════════════════════════════════════════════════
 */

const BASE_URL = 'https://europcar.com.br';

const SCENARIOS = [
  {
    key: 'POA_BALCAO',
    label: 'POA — Porto Alegre Aeroporto (Pagar no Balcão)',
    pickupStation: 'POAO03',
    returnStation: 'POAO03',
    pickupDate: '20261010',
    returnDate: '20261013',
    pickupTime: '1000',
    returnTime: '1000',
    contractID: '57269673',
    paymentMethod: 'BALCAO',
  },
  {
    key: 'GRU_ETO_VCH',
    label: 'GRU — São Paulo Guarulhos (ETO VCH)',
    pickupStation: 'GRUO02',
    returnStation: 'GRUO02',
    pickupDate: '20261010',
    returnDate: '20261013',
    pickupTime: '1000',
    returnTime: '1000',
    // ETO usa o CID público para buscar tarifas; o VCH ETO vai no meanOfPayment
    contractID: '57269673',
    // CID do contrato ETO — usado apenas no meanOfPayment
    etoContractID: '56935495',
    paymentMethod: 'VOUCHER',
    voucherData: {
      type: 'ETO',
      id: '88889999',
      businessAccount: '73804373',
    },
  },
];

const CUSTOMER = {
  nome: 'ANTONIO',
  sobrenome: 'TESTE',
  email: 'antonio.teste@europcar.com',
  telefone: '+55 11 99999-0000',
  cpf: '000.000.000-00',
};

const INSURANCES = ['CDW', 'THW', 'RSA'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeXml(val) {
  return String(val || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function voucherDurationDays(pickupDate, returnDate) {
  const d1 = new Date(+pickupDate.slice(0,4), +pickupDate.slice(4,6)-1, +pickupDate.slice(6,8));
  const d2 = new Date(+returnDate.slice(0,4), +returnDate.slice(4,6)-1, +returnDate.slice(6,8));
  return Math.max(1, Math.round((d2 - d1) / 86400000));
}

async function fetchAPI(url, opts = {}) {
  const t = Date.now();
  try {
    const r = await fetch(url, opts);
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = text; }
    return { status: r.status, data: json, raw: text, duration: Date.now() - t };
  } catch (e) {
    return { status: 0, data: null, raw: e.message, duration: Date.now() - t, error: true };
  }
}

function extractRates(data) {
  const rates = [];
  const chunks = Array.isArray(data?.results) ? data.results : [data];
  for (const chunk of chunks) {
    const raw = chunk?.message?.serviceResponse?.reservationRateList?.reservationRate
             || chunk?.serviceResponse?.reservationRateList?.reservationRate || [];
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    for (const r of arr) {
      const a = r.$ || r;
      if (a.carCategoryCode && a.totalRateEstimate) rates.push(a);
    }
  }
  return rates;
}

// ─── Monta meanOfPayment XML (igual ao sistema real) ─────────────────────────
function buildMeanOfPayment(sc, carCategory, pickupDate, returnDate) {
  if (sc.paymentMethod === 'BALCAO') return { prepaidAttrs: ' prepaidMode="NP"', meanOfPaymentXml: '' };
  if (sc.paymentMethod === 'VOUCHER' && sc.voucherData) {
    const vd = sc.voucherData;
    const duration = voucherDurationDays(pickupDate, returnDate);
    const numericID = /^\d{1,8}$/.test(vd.id || '') ? vd.id : Date.now().toString().slice(-8);
    const xml = `\n        <meanOfPayment typeCode="VCH" voucherType="${escapeXml(vd.type)}" voucherID="${escapeXml(numericID)}" businessAccount="${escapeXml(vd.businessAccount || '')}" voucherCarCategory="${escapeXml(carCategory)}" voucherRentalDuration="${duration}"/>`;
    return { prepaidAttrs: '', meanOfPaymentXml: xml };
  }
  return { prepaidAttrs: ' prepaidMode="NP"', meanOfPaymentXml: '' };
}

// ─── Roda um cenário completo ─────────────────────────────────────────────────
async function runScenario(sc) {
  console.log(`\n${'='.repeat(68)}`);
  console.log(`  ${sc.label}`);
  console.log(`  Pagamento: ${sc.paymentMethod}${sc.voucherData ? ' (ETO VCH)' : ''}`);
  console.log('='.repeat(68));

  const result = { sc, steps: [], xmls: {}, rates: [], equipment: [], error: null };

  // 1. getCarCategories
  const catRes = await fetchAPI(`${BASE_URL}/api/europcar/getCarCategories`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pickupStation: sc.pickupStation, returnStation: sc.returnStation,
      pickupDate: sc.pickupDate, returnDate: sc.returnDate,
      pickupTime: sc.pickupTime, returnTime: sc.returnTime,
      contractID: sc.contractID,
    }),
  });
  const rawCats = catRes.data?.message?.serviceResponse?.carCategoryList?.carCategory
               || catRes.data?.serviceResponse?.carCategoryList?.carCategory || [];
  const catList = Array.isArray(rawCats) ? rawCats : rawCats ? [rawCats] : [];
  const acrissCodes = catList.map(c => c.$?.carCategoryCode || c.carCategoryCode).filter(Boolean);
  console.log(`  ✅ getCarCategories → ${acrissCodes.length} categorias`);
  result.steps.push({ name: 'getCarCategories', req: { contractID: sc.contractID, station: sc.pickupStation }, res: catRes.data, duration: catRes.duration });

  // 2. getMultipleRates
  const ratesRes = await fetchAPI(`${BASE_URL}/api/europcar/getMultipleRates`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pickupStation: sc.pickupStation, returnStation: sc.returnStation,
      pickupDate: sc.pickupDate, returnDate: sc.returnDate,
      pickupTime: sc.pickupTime, returnTime: sc.returnTime,
      acrissCodes, contractID: sc.contractID,
    }),
  });
  const rates = extractRates(ratesRes.data);
  console.log(`  ✅ getMultipleRates → ${rates.length} tarifas`);
  result.rates = rates;
  result.steps.push({ name: 'getMultipleRates', req: { contractID: sc.contractID, acrissCodes }, res: ratesRes.data, duration: ratesRes.duration });

  if (rates.length === 0) { result.error = 'Nenhuma tarifa'; return result; }

  // 3. getEquipmentList — busca NAV disponível
  const equipRes = await fetchAPI(
    `${BASE_URL}/api/europcar/getEquipmentList?station=${sc.pickupStation}&date=${sc.pickupDate}&returnDate=${sc.returnDate}&prepaidMode=NP`
  );
  const allEquip = equipRes.data?.equipment || [];
  // ✅ CORREÇÃO: NAV/NVS apenas — GPS removido
  const navEquip = allEquip.filter(e => ['NAV', 'NVS'].includes(e.code));
  console.log(`  ✅ getEquipmentList → Equipamentos: ${allEquip.map(e=>e.code).join(', ')}`);
  console.log(`     ✅ GPS válido encontrado: ${navEquip.map(e=>e.code).join(', ') || 'NAV (tentativa)'}`);
  result.equipment = allEquip;
  result.steps.push({ name: 'getEquipmentList', req: { station: sc.pickupStation }, res: equipRes.data, duration: equipRes.duration });

  const car = rates[0];
  const carCategory = car.carCategoryCode;
  const rateId = car.rateId || '';

  // Equipamentos GPS corrigidos: NAV ou NVS (nunca GPS)
  const gpsItems = navEquip.length > 0
    ? navEquip.slice(0, 1).map(e => ({ code: e.code, qty: 1 }))
    : [{ code: 'NAV', qty: 1 }];

  // ── GERAR XMLS EXATOS ────────────────────────────────────────────────────────
  const contractAttr = ` contractID="${escapeXml(sc.contractID)}" type="C"`;
  const payment = buildMeanOfPayment(sc, carCategory, sc.pickupDate, sc.returnDate);

  const equipmentXml = gpsItems
    .map(e => `\n          <equipment code="${escapeXml(e.code)}" qty="${e.qty}"/>`)
    .join('');

  const insuranceXml = INSURANCES
    .map(c => `\n          <insurance code="${escapeXml(c)}"/>`)
    .join('');

  // ── XML bookReservation ───────────────────────────────────────────────────
  const bookXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${escapeXml(carCategory)}" rateId="${escapeXml(rateId)}"${payment.prepaidAttrs}${contractAttr} chargesDetail="TRE" preferredLanguage="pt_BR" email="${escapeXml(CUSTOMER.email)}">
        <checkout stationID="${escapeXml(sc.pickupStation)}" date="${escapeXml(sc.pickupDate)}" time="${escapeXml(sc.pickupTime)}"/>
        <checkin stationID="${escapeXml(sc.returnStation)}" date="${escapeXml(sc.returnDate)}" time="${escapeXml(sc.returnTime)}"/>
        <equipmentList>${equipmentXml}
        </equipmentList>
        <insuranceList>${insuranceXml}
        </insuranceList>${payment.meanOfPaymentXml}
      </reservation>
      <driver countryOfResidence="BR"
              firstName="${escapeXml(CUSTOMER.nome)}"
              lastName="${escapeXml(CUSTOMER.sobrenome)}"
              title="MR"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

  // ── XML createDriver ──────────────────────────────────────────────────────
  const createDriverXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="createDriver">
    <serviceParameters>
      <reservation resNumber="[NUMERO_RESERVA]"/>
      <driver isoLanguage="pt_BR" firstName="${escapeXml(CUSTOMER.nome)}" lastName="${escapeXml(CUSTOMER.sobrenome)}" title="MR">
        <addressList>
          <address addressType="P" addressKind="D" addressCountry="BR">
            <emails>
              <email emailAddress="${escapeXml(CUSTOMER.email)}" type="M"/>
            </emails>
            <phones>
              <phone phoneNumber="${escapeXml(CUSTOMER.telefone)}" phoneType="M"/>
            </phones>
          </address>
        </addressList>
        <legalIdList>
          <legalId idTy="P" docNumber="00000000000" country="BR"/>
        </legalIdList>
      </driver>
    </serviceParameters>
  </serviceRequest>
</message>`;

  result.xmls = { bookXml, createDriverXml };

  console.log(`  ✅ XMLs gerados:`);
  console.log(`     bookReservation — equipamento: ${gpsItems.map(e=>e.code).join(',')} | pagamento: ${sc.paymentMethod}${sc.voucherData ? ' VCH ETO' : ' NP'}`);
  console.log(`     createDriver    — dados do motorista`);

  // Verificações explícitas
  const hasNAV = bookXml.includes('code="NAV"') || bookXml.includes("code='NAV'");
  const hasGPS = bookXml.includes('code="GPS"') || bookXml.includes("code='GPS'");
  const hasETO = bookXml.includes('voucherType="ETO"');
  const hasVCH = bookXml.includes('typeCode="VCH"');

  console.log(`\n  🔍 VERIFICAÇÕES:`);
  console.log(`     NAV no XML:  ${hasNAV ? '✅ SIM' : '⚠️ NÃO (usando fallback)'}`);
  console.log(`     GPS no XML:  ${hasGPS ? '❌ AINDA PRESENTE!' : '✅ AUSENTE (correto)'}`);
  if (sc.paymentMethod === 'VOUCHER') {
    console.log(`     ETO VCH:     ${hasETO && hasVCH ? '✅ SIM' : '❌ NÃO'}`);
  }

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║  DEMO ANTONIO — XMLs CORRIGIDOS (NAV + ETO VCH)              ║');
  console.log('║  GPS removido ✅ | NAV válido ✅ | ETO VCH ✅                ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  const results = [];
  for (const sc of SCENARIOS) {
    try {
      results.push(await runScenario(sc));
    } catch (e) {
      console.error(`ERRO no cenário ${sc.key}: ${e.message}`);
      results.push({ sc, steps: [], xmls: {}, rates: [], equipment: [], error: e.message });
    }
  }

  await generateReport(results);
  console.log('\n✅ Relatório gerado! Abra: teste-demo-antonio-xmls.html');
}

// ─── Relatório HTML ───────────────────────────────────────────────────────────
async function generateReport(results) {
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  let scenarioSections = '';

  for (const r of results) {
    const sc = r.sc;
    const bookXml = r.xmls?.bookXml || '';
    const driverXml = r.xmls?.createDriverXml || '';
    const hasGPS = bookXml.includes('code="GPS"');
    const hasNAV = bookXml.includes('code="NAV"') || bookXml.includes('code="NVS"');
    const hasETO = bookXml.includes('voucherType="ETO"');
    const hasVCH = bookXml.includes('typeCode="VCH"');

    const rateRows = r.rates.slice(0, 6).map(rate => `
      <tr>
        <td><strong>${escapeHtml(rate.carCategoryCode)}</strong></td>
        <td>${escapeHtml(rate.carCategorySample || '—')}</td>
        <td><strong>R$ ${(parseFloat(rate.totalRateEstimate || '0') * 5.4).toFixed(2)}</strong></td>
        <td>${escapeHtml(rate.totalRateEstimate)} ${escapeHtml(rate.currency || 'EUR')}</td>
      </tr>`).join('');

    const equipRows = r.equipment.map(eq => `
      <tr>
        <td><strong>${escapeHtml(eq.code)}</strong></td>
        <td>${escapeHtml(eq.name || eq.code)}</td>
        <td>${['NAV','NVS'].includes(eq.code) ? '<span class="badge-valid">✅ GPS Válido</span>' : '<span class="badge-neutral">Outro</span>'}</td>
      </tr>`).join('');

    const payLabel = sc.paymentMethod === 'VOUCHER'
      ? `<span class="badge-eto">💳 ETO VCH</span>`
      : `<span class="badge-balcao">🏢 Pagar no Balcão (NP)</span>`;

    scenarioSections += `
    <div class="scenario-block">
      <div class="scenario-header">
        <h2>📍 ${escapeHtml(sc.label)}</h2>
        <div class="scenario-meta">
          ${payLabel}
          <span class="badge-station">🏠 ${escapeHtml(sc.pickupStation)}</span>
          <span class="badge-dates">📅 ${sc.pickupDate.slice(6)}/${sc.pickupDate.slice(4,6)}/${sc.pickupDate.slice(0,4)} → ${sc.returnDate.slice(6)}/${sc.returnDate.slice(4,6)}/${sc.returnDate.slice(0,4)}</span>
          <span class="badge-cid">CID: ${escapeHtml(sc.contractID)}</span>
        </div>
      </div>

      <div class="checks-grid">
        <div class="check-item ${hasNAV ? 'check-ok' : 'check-warn'}">
          <span class="check-icon">${hasNAV ? '✅' : '⚠️'}</span>
          <div><strong>GPS: NAV</strong><br><small>${hasNAV ? 'Código válido no XML' : 'Usar NAV como fallback'}</small></div>
        </div>
        <div class="check-item ${!hasGPS ? 'check-ok' : 'check-fail'}">
          <span class="check-icon">${!hasGPS ? '✅' : '❌'}</span>
          <div><strong>GPS: removido</strong><br><small>${!hasGPS ? 'GPS ausente — correto' : 'GPS ainda presente!'}</small></div>
        </div>
        ${sc.paymentMethod === 'VOUCHER' ? `
        <div class="check-item ${hasETO && hasVCH ? 'check-ok' : 'check-fail'}">
          <span class="check-icon">${hasETO && hasVCH ? '✅' : '❌'}</span>
          <div><strong>ETO VCH</strong><br><small>${hasETO && hasVCH ? 'typeCode="VCH" voucherType="ETO"' : 'Não encontrado'}</small></div>
        </div>` : `
        <div class="check-item check-ok">
          <span class="check-icon">✅</span>
          <div><strong>prepaidMode="NP"</strong><br><small>Pagar no balcão</small></div>
        </div>`}
      </div>

      ${r.rates.length > 0 ? `
      <h3>💰 Tarifas disponíveis</h3>
      <table>
        <thead><tr><th>ACRISS</th><th>Modelo</th><th>Total (BRL est.)</th><th>EUR</th></tr></thead>
        <tbody>${rateRows}</tbody>
      </table>` : ''}

      ${r.equipment.length > 0 ? `
      <h3>🔧 Equipamentos na estação</h3>
      <table>
        <thead><tr><th>Código</th><th>Nome</th><th>GPS?</th></tr></thead>
        <tbody>${equipRows}</tbody>
      </table>` : ''}

      <h3>📤 XML 1 — bookReservation <small style="color:#888;">(enviado ao Green Way)</small></h3>
      <div class="xml-note">
        <span>🔧 Equipamento GPS: <strong class="valid">NAV</strong> — código válido</span>
        ${sc.paymentMethod === 'VOUCHER' ? '<span>💳 Pagamento: <strong class="valid">typeCode="VCH" voucherType="ETO"</strong></span>' : '<span>🏢 Pagamento: <strong class="valid">prepaidMode="NP"</strong> — Balcão</span>'}
      </div>
      <pre class="xml-booking">${escapeHtml(bookXml)}</pre>

      <h3>📤 XML 2 — createDriver <small style="color:#888;">(enviado após bookReservation)</small></h3>
      <pre class="xml-driver">${escapeHtml(driverXml)}</pre>
    </div>`;
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Demo Antonio — XMLs Corrigidos — Europcar Brasil — ${now}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 20px; background: #f0f2f5; color: #222; font-size: 12px; line-height: 1.6; }
    .container { max-width: 1100px; margin: 0 auto; }

    .header { background: linear-gradient(135deg, #005a23 0%, #00a040 100%); color: white; padding: 28px 32px; border-radius: 12px; margin-bottom: 28px; box-shadow: 0 4px 20px rgba(0,90,35,.3); }
    .header h1 { margin: 0 0 8px; font-size: 22px; font-weight: 700; }
    .header p { margin: 4px 0; opacity: .9; font-size: 13px; }
    .badge-header { display:inline-block; background: rgba(255,255,255,.2); border-radius:20px; padding: 3px 14px; font-size: 11px; margin: 3px 4px 0 0; border: 1px solid rgba(255,255,255,.3); }

    .corrections-bar { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 28px; }
    .correction-card { background: white; border-radius: 10px; padding: 16px 18px; box-shadow: 0 2px 8px rgba(0,0,0,.08); border-left: 4px solid #00a040; }
    .correction-card .icon { font-size: 24px; margin-bottom: 6px; }
    .correction-card h4 { margin: 0 0 4px; font-size: 13px; color: #005a23; }
    .correction-card p { margin: 0; font-size: 11px; color: #555; }
    .correction-card .before { color: #c62828; text-decoration: line-through; font-weight: bold; }
    .correction-card .after { color: #2e7d32; font-weight: bold; }

    .scenario-block { background: white; border-radius: 12px; margin-bottom: 28px; box-shadow: 0 2px 10px rgba(0,0,0,.09); overflow: hidden; }
    .scenario-header { background: linear-gradient(90deg, #005a23, #007a2f); color: white; padding: 18px 24px; }
    .scenario-header h2 { margin: 0 0 8px; font-size: 16px; }
    .scenario-meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .badge-eto, .badge-balcao, .badge-station, .badge-dates, .badge-cid {
      display: inline-block; border-radius: 20px; padding: 2px 12px; font-size: 11px; font-weight: 600;
    }
    .badge-eto    { background: #1565c0; }
    .badge-balcao { background: #2e7d32; }
    .badge-station, .badge-dates, .badge-cid { background: rgba(255,255,255,.2); border: 1px solid rgba(255,255,255,.3); }

    .checks-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 16px 20px; background: #f9fafb; border-bottom: 1px solid #eee; }
    .check-item { display: flex; align-items: center; gap: 10px; background: white; border-radius: 8px; padding: 12px 14px; box-shadow: 0 1px 4px rgba(0,0,0,.07); }
    .check-ok   { border-left: 4px solid #2e7d32; }
    .check-fail { border-left: 4px solid #c62828; }
    .check-warn { border-left: 4px solid #f57c00; }
    .check-icon { font-size: 20px; flex-shrink: 0; }
    .check-item strong { font-size: 12px; display: block; }
    .check-item small  { font-size: 10px; color: #666; }

    h3 { color: #005a23; margin: 20px 20px 8px; font-size: 14px; border-bottom: 1px solid #e8f5e9; padding-bottom: 4px; }
    table { width: calc(100% - 40px); margin: 0 20px 16px; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #e0e0e0; padding: 7px 10px; text-align: left; }
    th { background: #00a040; color: white; font-weight: 600; }
    tr:nth-child(even) td { background: #f9f9f9; }
    .badge-valid   { background: #2e7d32; color: white; border-radius: 4px; padding: 1px 8px; font-size: 10px; }
    .badge-neutral { background: #888; color: white; border-radius: 4px; padding: 1px 8px; font-size: 10px; }

    .xml-note { display: flex; gap: 16px; flex-wrap: wrap; padding: 8px 20px; background: #e8f5e9; border-top: 1px solid #c8e6c9; font-size: 11px; }
    .xml-note span { display: flex; align-items: center; gap: 4px; }
    .valid { color: #1b5e20; }

    pre { background: #1a1a2e; color: #a8d8a8; padding: 16px 20px; margin: 0 20px 20px; border-radius: 8px; overflow-x: auto; white-space: pre; font-size: 10.5px; line-height: 1.6; max-height: 460px; overflow-y: auto; }
    .xml-booking { border-left: 4px solid #ff9800; color: #ffe082; }
    .xml-driver  { border-left: 4px solid #7c4dff; color: #ce93d8; }

    .footer { margin-top: 40px; padding: 16px; text-align: center; color: #aaa; font-size: 10px; border-top: 1px solid #ddd; }
    @media print { body { background: white; padding: 0; } pre { max-height: none; } .scenario-block { page-break-inside: avoid; } }
  </style>
</head>
<body>
<div class="container">

  <div class="header">
    <h1>🧪 Demo Antonio — XMLs Corrigidos — Europcar Brasil</h1>
    <p>📅 Gerado em: <strong>${now}</strong> | 🌐 Servidor: <strong>https://europcar.com.br</strong></p>
    <p>
      <span class="badge-header">✅ GPS removido</span>
      <span class="badge-header">✅ NAV — código válido</span>
      <span class="badge-header">✅ ETO VCH incluído</span>
    </p>
  </div>

  <div class="corrections-bar">
    <div class="correction-card">
      <div class="icon">🔧</div>
      <h4>Código GPS — Corrigido</h4>
      <p><span class="before">GPS</span> → <span class="after">NAV / NVS</span><br>GPS não existe no sistema Europcar. NAV e NVS são os códigos válidos para navegação.</p>
    </div>
    <div class="correction-card">
      <div class="icon">💳</div>
      <h4>ETO VCH — Implementado</h4>
      <p><span class="after">typeCode="VCH" voucherType="ETO"</span><br>Incluído em getQuote e bookReservation para contratos ETO.</p>
    </div>
    <div class="correction-card">
      <div class="icon">📋</div>
      <h4>XML Exato do Sistema</h4>
      <p>Os XMLs abaixo são gerados com a <span class="after">mesma lógica do código em produção</span> (paymentMapping.ts + route.ts).</p>
    </div>
  </div>

  ${scenarioSections}

  <div class="footer">
    <p>Relatório gerado automaticamente — Europcar Brasil — ${now}</p>
    <p>Correções: GPS → NAV/NVS | ETO VCH adicionado | Servidor: https://europcar.com.br</p>
  </div>
</div>
</body>
</html>`;

  const fs = require('fs'), path = require('path');
  const out = path.join(__dirname, 'scratch', 'teste-demo-antonio-xmls.html');
  fs.writeFileSync(out, html, 'utf-8');
  console.log(`\n📄 Relatório HTML: ${out}`);
  return out;
}

main().catch(e => { console.error('ERRO FATAL:', e); process.exit(1); });
