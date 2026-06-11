/**
 * test_stations.js
 * Testa os station codes válidos do XML oficial contra a API XRS da Europcar
 * CallerCode: 1132581 | Endpoint: PTN
 */

const https = require('https');
const querystring = require('querystring');

const CALLER_CODE = '1132581';
const PASSWORD = '27112025';
const ENDPOINT = 'https://applications-ptn.europcar.com/xrs/resxml';

// Estações válidas extraídas do XML oficial
const STATIONS_TO_TEST = [
  { code: 'CDGT01', name: 'Paris CDG T1', country: 'FR' },
  { code: 'CDGT02', name: 'Paris CDG T2D', country: 'FR' },
  { code: 'ORYT01', name: 'Paris Orly', country: 'FR' },
  { code: 'LYST01', name: 'Lyon Airport', country: 'FR' },
  { code: 'NCET02', name: 'Nice Airport', country: 'FR' },
  { code: 'FRAT01', name: 'Frankfurt Airport', country: 'DE' },
  { code: 'FRAT03', name: 'Frankfurt T3', country: 'DE' },
  { code: 'MUCT01', name: 'Munich Airport', country: 'DE' },
  { code: 'BERT01', name: 'Berlin Airport', country: 'DE' },
  { code: 'HAMT01', name: 'Hamburg Airport', country: 'DE' },
];

function buildGetStationXML(stationCode) {
  return `<message>
  <serviceRequest serviceCode="getStation">
    <serviceContext>
      <localisation active="true">
        <language code="en_US"/>
      </localisation>
    </serviceContext>
    <serviceParameters>
      <station stationCode="${stationCode}"/>
    </serviceParameters>
  </serviceRequest>
</message>`;
}

function postXRS(xmlRequest) {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      callerCode: CALLER_CODE,
      password: PASSWORD,
      'XML-Request': xmlRequest,
    });

    const url = new URL(ENDPOINT);
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });

    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
    req.write(postData);
    req.end();
  });
}

function parseResult(body) {
  if (body.includes('stationNotAllowedToPublic')) return '❌ stationNotAllowedToPublic';
  if (body.includes('stationNotFound') || body.includes('Station not found')) return '❌ stationNotFound';
  if (body.includes('<station ') && body.includes('stationCode')) return '✅ SUCESSO - Estação encontrada';
  if (body.includes('<Error>') || body.includes('<Errors>')) {
    const match = body.match(/<message>([^<]+)<\/message>/i) || body.match(/<Error[^>]*>([^<]+)<\/Error>/i);
    return `❌ Erro: ${match ? match[1] : 'Erro desconhecido'}`;
  }
  return `⚠️  Resposta inesperada`;
}

async function runTests() {
  console.log('='.repeat(70));
  console.log(' TESTE XRS EUROPCAR — Station Validation');
  console.log(` CallerCode: ${CALLER_CODE}`);
  console.log(` Endpoint:   ${ENDPOINT}`);
  console.log(` Data:       ${new Date().toISOString()}`);
  console.log('='.repeat(70));
  console.log('');

  const results = [];

  for (const station of STATIONS_TO_TEST) {
    process.stdout.write(`Testando ${station.code} (${station.name})... `);
    try {
      const xml = buildGetStationXML(station.code);
      const { status, body } = await postXRS(xml);
      const result = parseResult(body);
      console.log(result);
      results.push({ ...station, result, body });
    } catch (err) {
      console.log(`❌ ERRO DE REDE: ${err.message}`);
      results.push({ ...station, result: `❌ ERRO DE REDE: ${err.message}`, body: '' });
    }

    // Pequeno delay entre requests
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('');
  console.log('='.repeat(70));
  console.log(' RESUMO');
  console.log('='.repeat(70));

  const ok = results.filter(r => r.result.startsWith('✅'));
  const fail = results.filter(r => !r.result.startsWith('✅'));

  console.log(`✅ Sucessos:  ${ok.length}/${results.length}`);
  console.log(`❌ Falhas:    ${fail.length}/${results.length}`);
  console.log('');

  if (ok.length > 0) {
    console.log('Estações com acesso confirmado:');
    ok.forEach(r => console.log(`  → ${r.code} | ${r.name} (${r.country})`));
  }

  if (fail.length > 0) {
    console.log('');
    console.log('Estações com falha:');
    fail.forEach(r => console.log(`  → ${r.code} | ${r.name} (${r.country}) — ${r.result}`));
  }

  // Salvar resposta completa da primeira estação com sucesso para análise
  const firstOk = results.find(r => r.result.startsWith('✅'));
  if (firstOk) {
    const fs = require('fs');
    const outPath = __dirname + '/xrs_response_sample.xml';
    fs.writeFileSync(outPath, firstOk.body, 'utf8');
    console.log(`\n📄 Resposta completa salva em: xrs_response_sample.xml`);
  }

  console.log('');
}

runTests().catch(console.error);
