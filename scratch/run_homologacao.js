/**
 * EUROPCAR XRS — Runner de Homologação
 * Fluxo correto (PDFs Antonio, 19/05/2026):
 *   getCarCategories → getMultipleRates (carCategoryPattern) → getQuote (com rateId) → bookReservation
 */

const axios  = require('axios');
const xml2js = require('xml2js');
const fs     = require('fs');

const CALLER_CODE = "1132581";
const PASSWORD    = "27112025";
const ENDPOINT    = "https://applications-ptn.europcar.com/xrs/resxml";

// ── Parâmetros de teste ────────────────────────────────────────────────────
const PICKUP_STATION  = "GRUO02";
const RETURN_STATION  = "GRUO02";
const PICKUP_DATE     = "20260615";
const RETURN_DATE     = "20260617";
const PICKUP_TIME     = "1000";
const RETURN_TIME     = "1000";
const CAR_CATEGORY    = "EDMR";
const ETO_CID         = "56935466";
const ETO_BA          = "73675595";
const ETO_VOUCHER_ID  = "88889999";

// ── Relatório ──────────────────────────────────────────────────────────────
const report = {
  generated: new Date().toISOString(),
  environment: "PTN (homologação)",
  endpoint: ENDPOINT,
  callerCode: CALLER_CODE,
  flows: {}
};

function log(msg) { process.stdout.write(msg + '\n'); }

async function callXRS(xmlRequest, label) {
  const payload = new URLSearchParams();
  payload.append('callerCode', CALLER_CODE);
  payload.append('password', PASSWORD);
  payload.append('XML-Request', xmlRequest);

  log(`\n──────────────────────────────────────────`);
  log(`▶ [${label}] REQUEST`);
  log(xmlRequest.trim());

  let rawResponse = '';
  let httpStatus  = 0;
  let error       = null;

  try {
    const res = await axios.post(ENDPOINT, payload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 25000,
    });
    rawResponse = res.data;
    httpStatus  = res.status;
  } catch (err) {
    rawResponse = err.response?.data || err.message;
    httpStatus  = err.response?.status || 0;
    error       = err.message;
  }

  log(`\n◀ [${label}] RESPONSE (HTTP ${httpStatus})`);
  log(rawResponse);

  // Parse XML
  let parsed = null;
  try {
    parsed = await xml2js.parseStringPromise(rawResponse, { explicitArray: false });
  } catch (_) {}

  const resNode   = parsed?.message?.serviceResponse?.reservation;
  const errorNode = parsed?.message?.serviceResponse?.error || parsed?.message?.serviceResponse?.errors;
  const hasError  = !!errorNode || rawResponse.includes('<error') || rawResponse.includes('<errors');

  // Extract rateId: from getMultipleRates (reservationRateList) or from getQuote (reservation.$)
  let rateId = null;
  const rateList = parsed?.message?.serviceResponse?.reservationRateList?.reservationRate;
  if (rateList) {
    const rates = Array.isArray(rateList) ? rateList : [rateList];
    const match = rates.find(r => r.$?.carCategoryCode === CAR_CATEGORY);
    rateId = match?.$?.rateId ?? rates[0]?.$?.rateId ?? null;
  } else {
    rateId = resNode?.$?.rateId ?? null;
  }

  // Extract ACRISS codes from getCarCategories response
  let acrissCodes = [];
  const catList = parsed?.message?.serviceResponse?.carCategoryList?.carCategory;
  if (catList) {
    const cats = Array.isArray(catList) ? catList : [catList];
    acrissCodes = cats.map(c => c.$?.carCategoryCode).filter(Boolean);
  }

  return {
    label,
    request: xmlRequest.trim(),
    response: rawResponse,
    httpStatus,
    parsed,
    resNode,
    error,
    hasError,
    rateId,
    acrissCodes,
    resNumber:  resNode?.$?.resNumber  ?? null,
    statusCode: resNode?.$?.statusCode ?? null,
    totalRate:  resNode?.quote?.$?.totalRateEstimate ?? resNode?.$?.totalRateEstimate ?? null,
    currency:   resNode?.quote?.$?.currency ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FLUXO CC / POA
// ─────────────────────────────────────────────────────────────────────────────
async function runCCFlow() {
  log('\n\n╔══════════════════════════════════════════╗');
  log('║         FLUXO CC / POA                  ║');
  log('╚══════════════════════════════════════════╝');

  const flow = { steps: [], resNumber: null, success: false };

  // 1. getCarCategories
  const s1 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getCarCategories">
    <serviceParameters>
      <reservation contractID="${ETO_CID}">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`, "CC_getCarCategories");
  flow.steps.push(s1);

  // Build carCategoryPattern from step 1 (chunks of 10, as per spec)
  const codes = s1.acrissCodes.length > 0 ? s1.acrissCodes : [CAR_CATEGORY];
  const chunks = [];
  for (let i = 0; i < codes.length; i += 10) chunks.push(codes.slice(i, i + 10));

  // 2. getMultipleRates — usando carCategoryPattern (conforme especificação Europcar)
  let gmrRateId = null;
  for (let i = 0; i < chunks.length; i++) {
    const pattern = chunks[i].join('');
    const s2 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getMultipleRates">
    <serviceParameters>
      <reservation carCategoryPattern="${pattern}" rateDetails="Y" contractID="${ETO_CID}" type="C">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`, `CC_getMultipleRates_${i + 1}`);
    flow.steps.push(s2);
    if (s2.rateId) gmrRateId = s2.rateId;
  }

  if (!gmrRateId) log('\n⚠ getMultipleRates não retornou rateId para EDMR.');

  // 3. getQuote — sem meanOfPayment para CC/POA; com rateId do getMultipleRates
  const rateIdForQuote = gmrRateId ? ` rateId="${gmrRateId}"` : '';
  const s3 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getQuote">
    <caller/>
    <serviceParameters>
      <reservation carCategory="${CAR_CATEGORY}" contractID="${ETO_CID}" type="C"
                   chargesDetail="TRE" rateDetails="Y" prepaidMode="NP"${rateIdForQuote}>
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`, "CC_getQuote");
  flow.steps.push(s3);

  const quoteRateId = s3.rateId;

  // 4. bookReservation CC
  const rateIdForBook = quoteRateId ? ` rateId="${quoteRateId}"` : (gmrRateId ? ` rateId="${gmrRateId}"` : '');
  const s4 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${CAR_CATEGORY}"${rateIdForBook} contractID="${ETO_CID}" type="C"
                   preferredLanguage="pt_BR">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
        <equipmentList/>
      </reservation>
      <driver countryOfResidence="BR"
              firstName="Teste"
              lastName="Homologacao"
              title="MR"
              driverID="12345678900"
              email="teste@europcar.com.br"
              phone="+5511999999999"/>
    </serviceParameters>
  </serviceRequest>
</message>`, "CC_bookReservation");
  flow.steps.push(s4);

  flow.resNumber = s4.resNumber;
  flow.statusCode = s4.statusCode;
  flow.success   = !!s4.resNumber;

  // 5. Se On Request → searchById
  if (s4.statusCode === 'R' && s4.resNumber) {
    log(`\n⚠ Reserva On Request detectada: ${s4.resNumber} — consultando status...`);
    const s5 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="search.searchbyid">
    <serviceParameters>
      <reservation resNumber="${s4.resNumber}" />
    </serviceParameters>
  </serviceRequest>
</message>`, `CC_searchById_${s4.resNumber}`);
    flow.steps.push(s5);
  }

  report.flows.CC = flow;
  return flow;
}

// ─────────────────────────────────────────────────────────────────────────────
// FLUXO ETO VOUCHER
// ─────────────────────────────────────────────────────────────────────────────
async function runETOFlow() {
  log('\n\n╔══════════════════════════════════════════╗');
  log('║         FLUXO ETO VOUCHER               ║');
  log('╚══════════════════════════════════════════╝');

  const flow = { steps: [], resNumber: null, success: false };

  // 1. getCarCategories
  const s1 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getCarCategories">
    <serviceParameters>
      <reservation contractID="${ETO_CID}">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`, "ETO_getCarCategories");
  flow.steps.push(s1);

  // Build carCategoryPattern
  const codes = s1.acrissCodes.length > 0 ? s1.acrissCodes : [CAR_CATEGORY];
  const chunks = [];
  for (let i = 0; i < codes.length; i += 10) chunks.push(codes.slice(i, i + 10));

  // 2. getMultipleRates — com equipmentList para obter equipamentos disponíveis (conforme ETO PDF)
  let gmrRateId = null;
  for (let i = 0; i < chunks.length; i++) {
    const pattern = chunks[i].join('');
    const s2 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getMultipleRates">
    <serviceParameters>
      <reservation carCategoryPattern="${pattern}" rateDetails="Y" contractID="${ETO_CID}" type="C">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
        <equipmentList/>
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`, `ETO_getMultipleRates_${i + 1}`);
    flow.steps.push(s2);
    if (s2.rateId) gmrRateId = s2.rateId;
  }

  // 3. getQuote com ETO MOP e rateId do getMultipleRates (sem voucherFullCredit — conforme PDF Antonio)
  const rateIdForQuote = gmrRateId ? ` rateId="${gmrRateId}"` : '';
  const s3 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getQuote">
    <caller/>
    <serviceParameters>
      <reservation carCategory="${CAR_CATEGORY}" contractID="${ETO_CID}" type="C"
                   chargesDetail="TRE"${rateIdForQuote}>
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
        <meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${ETO_VOUCHER_ID}"
                       businessAccount="${ETO_BA}" voucherCarCategory="${CAR_CATEGORY}"
                       voucherRentalDuration="2"/>
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`, "ETO_getQuote");
  flow.steps.push(s3);

  const quoteRateId = s3.rateId;

  // 4. bookReservation ETO (chargesDetail="TRE", sem voucherFullCredit — conforme PDF Antonio)
  const rateIdForBook = quoteRateId ? ` rateId="${quoteRateId}"` : (gmrRateId ? ` rateId="${gmrRateId}"` : '');
  const s4 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${CAR_CATEGORY}"${rateIdForBook} contractID="${ETO_CID}" type="C"
                   chargesDetail="TRE" preferredLanguage="pt_BR">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
        <equipmentList/>
        <meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${ETO_VOUCHER_ID}"
                       businessAccount="${ETO_BA}" voucherCarCategory="${CAR_CATEGORY}"
                       voucherRentalDuration="2"/>
      </reservation>
      <driver countryOfResidence="BR"
              firstName="Teste"
              lastName="Homologacao"
              title="MR"
              driverID="12345678900"
              email="teste@europcar.com.br"
              phone="+5511999999999"/>
    </serviceParameters>
  </serviceRequest>
</message>`, "ETO_bookReservation");
  flow.steps.push(s4);

  flow.resNumber  = s4.resNumber;
  flow.statusCode = s4.statusCode;
  flow.success    = !!s4.resNumber;

  // 5. Se On Request → searchById
  if (s4.statusCode === 'R' && s4.resNumber) {
    log(`\n⚠ Reserva On Request detectada: ${s4.resNumber} — consultando status...`);
    const s5 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="search.searchbyid">
    <serviceParameters>
      <reservation resNumber="${s4.resNumber}" />
    </serviceParameters>
  </serviceRequest>
</message>`, `ETO_searchById_${s4.resNumber}`);
    flow.steps.push(s5);
  }

  report.flows.ETO = flow;
  return flow;
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTE search.searchbyid — reserva On Request rejeitada (solicitado por Antonio)
// ─────────────────────────────────────────────────────────────────────────────
async function runSearchByIdRejected() {
  log('\n\n╔══════════════════════════════════════════╗');
  log('║  search.searchbyid — On Request FAILED  ║');
  log('╚══════════════════════════════════════════╝');

  const flow = { steps: [], resNumber: '1201263810', success: false };

  const s1 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="search.searchbyid">
    <serviceParameters>
      <reservation resNumber="1201263810" />
    </serviceParameters>
  </serviceRequest>
</message>`, "searchById_1201263810_FAILED");
  flow.steps.push(s1);

  const warnings = s1.parsed?.message?.serviceResponse?.warningList?.warning;
  const warnArr = Array.isArray(warnings) ? warnings : (warnings ? [warnings] : []);
  const hasW1 = warnArr.some(w => w.$?.warningCode === '1' && w.$?.warningDesc === 'xrs.reservation.nochangeallowed');
  const hasW2 = warnArr.some(w => w.$?.warningCode === '2' && w.$?.warningDesc === 'xrs.reservation.OneOnRequestItemFailed');
  flow.success = hasW1 && hasW2;
  flow.warnings = { nochangeallowed: hasW1, OneOnRequestItemFailed: hasW2 };

  report.flows.searchById_OnRequest_FAILED = flow;
  return flow;
}

// ─────────────────────────────────────────────────────────────────────────────
// RELATÓRIO FINAL
// ─────────────────────────────────────────────────────────────────────────────
function statusIcon(ok) { return ok ? '✅' : '❌'; }

function printReport() {
  const lines = [];
  const push  = (l) => { lines.push(l); log(l); };

  push('\n\n');
  push('═══════════════════════════════════════════════════════════════');
  push('  RELATÓRIO DE HOMOLOGAÇÃO — EUROPCAR XRS');
  push('═══════════════════════════════════════════════════════════════');
  push(`  Data/Hora : ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  push(`  Ambiente  : PTN (pré-produção)`);
  push(`  Endpoint  : ${ENDPOINT}`);
  push(`  CallerCode: ${CALLER_CODE}`);
  push('───────────────────────────────────────────────────────────────');

  const statusLabel = {
    'S': 'Vendida (S)', 'R': 'On Request (R)', 'CF': 'Confirmada (CF)',
    'CC': 'Cancelada (CC)', 'CP': 'Cancelada Pré-pago (CP)',
    'CO': 'Check-out (CO)', 'NS': 'No Show (NS)', 'TD': 'Turn Down (TD)',
  };

  for (const [flowName, flow] of Object.entries(report.flows)) {
    push(`\n  FLUXO: ${flowName}`);
    push('  ─────────────────────────────────────────────────────────');
    for (const step of flow.steps) {
      const ok = !step.hasError;
      const extra = step.rateId    ? `  rateId=${step.rateId.slice(0,16)}...` :
                    step.resNumber ? `  resNumber=${step.resNumber}` : '';
      const rate  = step.totalRate ? `  total=${step.totalRate} ${step.currency ?? ''}` : '';
      const sc    = step.statusCode ? `  status=${statusLabel[step.statusCode] ?? step.statusCode}` : '';
      push(`  ${statusIcon(ok)} ${step.label.padEnd(35)} HTTP ${step.httpStatus}${extra}${rate}${sc}`);
      if (!ok) push(`       └─ ⚠ ERRO na resposta XRS`);
    }
    if (flow.warnings) {
      push(`\n  Avisos detectados:`);
      push(`  ${statusIcon(flow.warnings.nochangeallowed)}  xrs.reservation.nochangeallowed`);
      push(`  ${statusIcon(flow.warnings.OneOnRequestItemFailed)}  xrs.reservation.OneOnRequestItemFailed`);
    }
    push(`\n  Resultado: ${flow.success ? `✅ OK — ${flow.resNumber ?? ''}` : '❌ Falha'}`);
  }

  push('\n───────────────────────────────────────────────────────────────');
  push('  CONFORMIDADE COM ESPECIFICAÇÃO XRS (PDFs Antonio, 19/05/2026)');
  push('───────────────────────────────────────────────────────────────');

  const ccSteps  = report.flows.CC?.steps  ?? [];
  const etoSteps = report.flows.ETO?.steps ?? [];

  const ccGMR   = ccSteps.find(s => s.label.includes('getMultipleRates'));
  const etoGMR  = etoSteps.find(s => s.label.includes('getMultipleRates'));
  const ccQuote  = ccSteps.find(s => s.label === 'CC_getQuote');
  const etoQuote = etoSteps.find(s => s.label === 'ETO_getQuote');
  const etoBook  = etoSteps.find(s => s.label === 'ETO_bookReservation');

  const gmrUsesPattern    = !!ccGMR && ccGMR.request.includes('carCategoryPattern=');
  const gmrBeforeQuoteCC  = !!ccGMR && ccSteps.indexOf(ccGMR) < ccSteps.indexOf(ccQuote);
  const gmrBeforeQuoteETO = !!etoGMR && etoSteps.indexOf(etoGMR) < etoSteps.indexOf(etoQuote);
  const noCardMopInCC     = ccQuote  && !ccQuote.request.includes('typeCode="CARD"');
  const etoMopInETO       = etoQuote && etoQuote.request.includes('typeCode="VCH"');
  const noVFCInETOQuote   = etoQuote && !etoQuote.request.includes('voucherFullCredit');
  const noVFCInETOBook    = etoBook  && !etoBook.request.includes('voucherFullCredit');
  const chargesDetailETO  = etoBook  && etoBook.request.includes('chargesDetail="TRE"');
  const noDoubleCCCall    = etoSteps.filter(s => s.label.includes('getQuote')).length === 1;
  const onReqHandled      = [...ccSteps, ...etoSteps].some(s => s.label.includes('searchById'));
  const searchByIdFailed  = report.flows.searchById_OnRequest_FAILED?.success;

  push(`  ${statusIcon(gmrUsesPattern)}   getMultipleRates usa carCategoryPattern (não carCategory)`);
  push(`  ${statusIcon(gmrBeforeQuoteCC)}   getMultipleRates antes do getQuote (fluxo CC)`);
  push(`  ${statusIcon(gmrBeforeQuoteETO)}   getMultipleRates antes do getQuote (fluxo ETO)`);
  push(`  ${statusIcon(noCardMopInCC)}   meanOfPayment CARD ausente do getQuote CC`);
  push(`  ${statusIcon(etoMopInETO)}   meanOfPayment ETO presente no getQuote ETO`);
  push(`  ${statusIcon(noVFCInETOQuote)}   voucherFullCredit ausente no getQuote ETO`);
  push(`  ${statusIcon(noVFCInETOBook)}   voucherFullCredit ausente no bookReservation ETO`);
  push(`  ${statusIcon(chargesDetailETO)}   chargesDetail="TRE" no bookReservation ETO`);
  push(`  ${statusIcon(noDoubleCCCall)}   Apenas 1 getQuote no fluxo ETO`);
  push(`  ${statusIcon(report.flows.CC?.success)}   bookReservation CC concluído`);
  push(`  ${statusIcon(report.flows.ETO?.success)}   bookReservation ETO concluído`);
  push(`  ${statusIcon(true)}   search.searchbyid implementado${onReqHandled ? ' (acionado)' : ' (pronto)'}`);
  push(`  ${statusIcon(searchByIdFailed)}   search.searchbyid On Request FAILED (1201263810) — avisos corretos`);

  push('\n═══════════════════════════════════════════════════════════════\n');

  const jsonPath = './scratch/relatorio_homologacao.json';
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  log(`\n📄 Relatório JSON salvo em: ${jsonPath}\n`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  await runSearchByIdRejected();
  await runCCFlow();
  await runETOFlow();
  printReport();
}

main().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
