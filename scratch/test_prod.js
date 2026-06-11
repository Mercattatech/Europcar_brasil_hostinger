
const axios = require('axios');

const CALLER_CODE = "1132581";
const PASSWORD = "27112025";
const ENDPOINT_PROD = "https://applications.europcar.com/xrs/resxml";

async function testProd() {
    console.log("--- TESTANDO API EUROPCAR (PRODUÇÃO) ---");
    
    const pickupDate = "20260620";
    const returnDate = "20260625";
    const station = "VCPT02"; // Campinas (Present in getStations list)

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
        const response = await axios.post(ENDPOINT_PROD, payload.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 20000,
        });

        console.log("Status HTTP:", response.status);
        console.log("Resposta (truncada):", response.data.substring(0, 1000));
        
        if (response.data.includes('carList')) {
            console.log("✅ SUCESSO NA PRODUÇÃO!");
        } else {
            console.log("❌ ERRO NA PRODUÇÃO:", response.data);
        }
    } catch (error) {
        console.error("❌ FALHA NA PRODUÇÃO:", error.message);
    }
}

testProd();
