
const axios = require('axios');

const CALLER_CODE = "1132581";
const PASSWORD = "27112025";
const ENDPOINT = "https://applications-ptn.europcar.com/xrs/resxml";

async function testAPI() {
    console.log("--- TESTANDO API EUROPCAR (getStations) ---");
    
    const xmlRequest = `
<message>
  <serviceRequest serviceCode="getStations">
    <serviceParameters>
      <station countryCode="BR"/>
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
        console.log("Resposta Raw:", response.data);
        
        if (response.data.includes('error') || response.data.includes('Fault')) {
            console.error("❌ A API retornou um erro na resposta.");
        } else {
            console.log("✅ A API parece estar respondendo corretamente!");
        }
    } catch (error) {
        console.error("❌ FALHA NA CONEXÃO COM A API:");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Dados:", error.response.data);
        } else {
            console.error("Mensagem:", error.message);
        }
    }
}

testAPI();
