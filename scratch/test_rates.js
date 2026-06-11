
const axios = require('axios');

const CALLER_CODE = "1132581";
const PASSWORD = "27112025";
const ENDPOINT = "https://applications-ptn.europcar.com/xrs/resxml";

async function testRates() {
    console.log("--- TESTANDO API EUROPCAR (getMultipleRates) ---");
    
    // Teste para Junho de 2026
    const pickupDate = "20260601";
    const returnDate = "20260605";
    const station = "SAOC04"; // Sao Paulo Santo Amaro

    const xmlRequest = `
<message>
  <serviceRequest serviceCode="getMultipleRates">
    <serviceParameters>
      <reservation>
        <checkout stationID="${station}" date="${pickupDate}" time="1000"/>
        <checkin stationID="${station}" date="${returnDate}" time="1000"/>
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`.trim();

    const payload = new URLSearchParams();
    payload.append('callerCode', CALLER_CODE);
    payload.append('password', PASSWORD);
    payload.append('XML-Request', xmlRequest);

    try {
        const response = await axios.post(ENDPOINT, payload.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 20000,
        });

        console.log("Status HTTP:", response.status);
        console.log("Resposta Raw (truncada):", response.data.substring(0, 1000));
        
        if (response.data.includes('error') || response.data.includes('Fault')) {
            console.error("❌ A API retornou um ERRO ou Falha.");
            console.log("Conteúdo do erro:", response.data);
        } else if (response.data.includes('carList')) {
            console.log("✅ getMultipleRates retornou veículos com sucesso!");
        } else {
            console.log("❓ Resposta inesperada, mas sem erro explícito.");
        }
    } catch (error) {
        console.error("❌ FALHA NA CONEXÃO:");
        console.error(error.message);
    }
}

testRates();
