
const axios = require('axios');

const CALLER_CODE = "1132581";
const PASSWORD = "27112025";
const ENDPOINT = "https://applications-ptn.europcar.com/xrs/resxml";

async function testCategories() {
    console.log("--- TESTANDO API EUROPCAR (getCarCategories) ---");
    
    const xmlRequest = `
<message>
  <serviceRequest serviceCode="getCarCategories">
    <serviceParameters>
      <carCategory countryCode="BR"/>
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
            console.error("❌ ERRO.");
        } else {
            console.log("✅ OK!");
        }
    } catch (error) {
        console.error("❌ FALHA:", error.message);
    }
}

testCategories();
