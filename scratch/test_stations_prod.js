
const axios = require('axios');

const CALLER_CODE = "1132581";
const PASSWORD = "27112025";
const ENDPOINT_PROD = "https://applications.europcar.com/xrs/resxml";

async function testStationsProd() {
    console.log("--- TESTANDO getStations (PRODUÇÃO) ---");
    
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
        const response = await axios.post(ENDPOINT_PROD, payload.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 20000,
        });

        console.log("Status HTTP:", response.status);
        console.log("Resposta Raw:", response.data);
    } catch (error) {
        console.error("❌ FALHA:", error.message);
    }
}

testStationsProd();
