/**
 * EUROPCAR XRS — Runner de Homologação
 * Executa fluxos CC e ETO e gera relatório para Ewa Suchorska.
 */

const axios  = require('axios');
const xml2js = require('xml2js');
const fs     = require('fs');

const CALLER_CODE = "1132581";
const PASSWORD    = "27112025";
const ENDPOINT    = "https://applications-ptn.europcar.com/xrs/resxml";

// ── Parâmetros de teste ────────────────────────────────────────────────────
const PICKUP_STATION  = "GRUO02";
const RETURN_STATION  = "GRUO02";    // one-way: altere para outra estação
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

  return {
    label,
    request: xmlRequest.trim(),
    response: rawResponse,
    httpStatus,
    parsed,
    resNode,
    error,
    hasError,
    rateId:     resNode?.$?.rateId     ?? null,
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
      <reservation contractID="${ETO_CID}" type="C">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`, "CC_getCarCategories");
  flow.steps.push(s1);

  // 2. getQuote (sem meanOfPayment — não necessário para CC POA, conforme Europcar)
  const s2 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getQuote">
    <caller/>
    <serviceParameters>
      <reservation carCategory="${CAR_CATEGORY}" contractID="${ETO_CID}" type="C" chargesDetail="TRE">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`, "CC_getQuote");
  flow.steps.push(s2);

  const rateId = s2.rateId;
  if (!rateId) {
    log('\n⚠ getQuote não retornou rateId — bookReservation será tentado sem rateId.');
  }

  // 3. bookReservation CC (BALCÃO)
  const rateIdAttr = rateId ? ` rateId="${rateId}"` : '';
  const s3 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${CAR_CATEGORY}"${rateIdAttr} contractID="${ETO_CID}" type="C"
                   prepaidMode="NP" chargesDetail="TRE" preferredLanguage="pt_BR">
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
  flow.steps.push(s3);

  flow.resNumber = s3.resNumber;
  flow.statusCode = s3.statusCode;
  flow.success   = !!s3.resNumber;

  // 4. Se On Request → searchById
  if (s3.statusCode === 'R' && s3.resNumber) {
    log(`\n⚠ Reserva On Request detectada: ${s3.resNumber} — consultando status...`);
    const s4 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="search.searchbyid">
    <serviceParameters>
      <reservation resNumber="${s3.resNumber}" />
    </serviceParameters>
  </serviceRequest>
</message>`, `CC_searchById_${s3.resNumber}`);
    flow.steps.push(s4);
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
      <reservation contractID="${ETO_CID}" type="C">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`, "ETO_getCarCategories");
  flow.steps.push(s1);

  // 2. getQuote com ETO MOP (único getQuote neste fluxo)
  const s2 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getQuote">
    <caller/>
    <serviceParameters>
      <reservation carCategory="${CAR_CATEGORY}" contractID="${ETO_CID}" type="C" chargesDetail="TRE">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
        <meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${ETO_VOUCHER_ID}"
                       businessAccount="${ETO_BA}" voucherCarCategory="${CAR_CATEGORY}"
                       voucherRentalDuration="2" voucherFullCredit="Y"/>
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`, "ETO_getQuote");
  flow.steps.push(s2);

  const rateId = s2.rateId;

  // 3. bookReservation ETO
  const rateIdAttr = rateId ? ` rateId="${rateId}"` : '';
  const s3 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${CAR_CATEGORY}"${rateIdAttr} contractID="${ETO_CID}" type="C"
                   chargesDetail="TRE" preferredLanguage="pt_BR">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
        <equipmentList/>
        <meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${ETO_VOUCHER_ID}"
                       businessAccount="${ETO_BA}" voucherCarCategory="${CAR_CATEGORY}"
                       voucherRentalDuration="2" voucherFullCredit="Y"/>
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
  flow.steps.push(s3);

  flow.resNumber  = s3.resNumber;
  flow.statusCode = s3.statusCode;
  flow.success    = !!s3.resNumber;

  // 4. Se On Request → searchById
  if (s3.statusCode === 'R' && s3.resNumber) {
    log(`\n⚠ Reserva On Request detectada: ${s3.resNumber} — consultando status...`);
    const s4 = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="search.searchbyid">
    <serviceParameters>
      <reservation resNumber="${s3.resNumber}" />
    </serviceParameters>
  </serviceRequest>
</message>`, `ETO_searchById_${s3.resNumber}`);
    flow.steps.push(s4);
  }

  report.flows.ETO = flow;
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
      const extra = step.rateId    ? `  rateId=${step.rateId}` :
                    step.resNumber ? `  resNumber=${step.resNumber}` : '';
      const rate  = step.totalRate ? `  total=${step.totalRate} ${step.currency ?? ''}` : '';
      const sc    = step.statusCode ? `  status=${statusLabel[step.statusCode] ?? step.statusCode}` : '';
      push(`  ${statusIcon(ok)} ${step.label.padEnd(30)} HTTP ${step.httpStatus}${extra}${rate}${sc}`);
      if (!ok) push(`       └─ ⚠ ERRO na resposta XRS`);
    }
    push(`\n  Resultado: ${flow.success ? `✅ Reserva criada — ${flow.resNumber} (${statusLabel[flow.statusCode] ?? flow.statusCode ?? 'N/A'})` : '❌ Falha — sem resNumber'}`);
  }

  push('\n───────────────────────────────────────────────────────────────');
  push('  CONFORMIDADE COM ESPECIFICAÇÃO XRS (e-mail Ewa Suchorska)');
  push('───────────────────────────────────────────────────────────────');

  const ccSteps  = report.flows.CC?.steps  ?? [];
  const etoSteps = report.flows.ETO?.steps ?? [];

  const ccQuote  = ccSteps.find(s => s.label === 'CC_getQuote');
  const etoQuote = etoSteps.find(s => s.label === 'ETO_getQuote');

  const noCardMopInCC  = ccQuote  && !ccQuote.request.includes('typeCode="CARD"');
  const etoMopInETO    = etoQuote && etoQuote.request.includes('typeCode="VCH"');
  const noDoubleCCCall = etoSteps.filter(s => s.label.includes('getQuote')).length === 1;
  const onReqHandled   = [...ccSteps, ...etoSteps].some(s => s.label.includes('searchById'));

  push(`  ${statusIcon(noCardMopInCC)}  meanOfPayment CARD removido do getQuote CC`);
  push(`  ${statusIcon(etoMopInETO)}   meanOfPayment ETO presente no fluxo ETO`);
  push(`  ${statusIcon(noDoubleCCCall)}  Apenas 1 getQuote no fluxo ETO (sem duplicata)`);
  push(`  ${statusIcon(report.flows.CC?.success)}  bookReservation CC concluído`);
  push(`  ${statusIcon(report.flows.ETO?.success)}  bookReservation ETO concluído`);
  push(`  ${statusIcon(true)}   search.searchbyid implementado${onReqHandled ? ' (chamado — On Request detectado)' : ' (pronto — não acionado nesta rodada)'}`);

  push('\n═══════════════════════════════════════════════════════════════\n');

  // Salvar relatório JSON
  const jsonPath = './scratch/relatorio_homologacao.json';
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  log(`\n📄 Relatório JSON salvo em: ${jsonPath}\n`);

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  await runCCFlow();
  await runETOFlow();
  printReport();
}

main().catch(err => {
  console.error('Erro fatal:', err.message);
  process.exit(1);
});
