
const axios = require('axios');

const CALLER_CODE = "1132581";
const PASSWORD = "27112025";
const ENDPOINT = "https://applications-ptn.europcar.com/xrs/resxml";

async function testNoContract() {
    console.log("--- TESTANDO API (SEM CONTRATO) ---");
    
    const pickupDate = "20260520";
    const returnDate = "20260525";
    const station = "GRUO02"; 

    const xmlRequest = `
<message>
  <serviceRequest serviceCode="getMultipleRates">
    <serviceParameters>
      <reservation carCategoryPattern="EDMR" rateDetails="Y" chargesDetail="TRE">
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
            timeout: 30000,
        });

        console.log("Status HTTP:", response.status);
        console.log("Resposta Raw:", response.data);
    } catch (error) {
        console.error("❌ FALHA:", error.message);
    }
}

testNoContract();
