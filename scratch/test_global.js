
const axios = require('axios');

const CALLER_CODE = "1132581";
const PASSWORD = "27112025";
const ENDPOINT = "https://applications-ptn.europcar.com/xrs/resxml";

async function testGlobal() {
    console.log("--- TESTANDO API EUROPCAR (getMultipleRates - LISBOA) ---");
    
    const pickupDate = "20260710";
    const returnDate = "20260715";
    const station = "LISO01"; // Lisbon Airport

    const xmlRequest = `
<message>
  <serviceRequest serviceCode="getMultipleRates">
    <serviceParameters>
      <reservation carCategoryPattern="MDMR" rateDetails="Y" chargesDetail="TRE">
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
        console.log("Resposta (truncada):", response.data.substring(0, 1000));
    } catch (error) {
        console.error("❌ FALHA:", error.message);
    }
}

testGlobal();
