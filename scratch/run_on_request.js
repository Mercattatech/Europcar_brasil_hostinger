const axios = require('axios');
const fs = require('fs');

const CALLER_CODE = "1132581";
const PASSWORD = "27112025";
const ENDPOINT = "https://applications-ptn.europcar.com/xrs/resxml";

async function callXRS(xmlRequest, action) {
    const payload = new URLSearchParams();
    payload.append('callerCode', CALLER_CODE);
    payload.append('password', PASSWORD);
    payload.append('XML-Request', xmlRequest);

    console.log(`\n\n=== [${action}] REQUEST ===\n${xmlRequest}`);
    
    // Save request to file for the logs
    fs.writeFileSync(`scratch/xml_logs/on_request_${action}_REQUEST.xml`, xmlRequest);

    try {
        const response = await axios.post(ENDPOINT, payload.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 20000,
        });
        console.log(`\n=== [${action}] RESPONSE ===\n${response.data}`);
        
        // Save response to file
        fs.writeFileSync(`scratch/xml_logs/on_request_${action}_RESPONSE.xml`, response.data);
        
        return response.data;
    } catch (error) {
        console.error(`\n❌ [${action}] FAILED:`, error.response?.data || error.message);
    }
}

const PICKUP_STATION = "GRUO02";
const RETURN_STATION = "GRUO02";
const PICKUP_DATE    = "20260615";
const RETURN_DATE    = "20260617";
const PICKUP_TIME    = "1000";
const RETURN_TIME    = "1000";
const CAR_CATEGORY   = "SFAR"; // This category has statusCode="R"

const ETO_CONTRACT_ID = "56935466";
const ETO_BA          = "73675595";
const ETO_VOUCHER_ID  = "88889999"; 

async function run() {
    if (!fs.existsSync('scratch/xml_logs')) {
        fs.mkdirSync('scratch/xml_logs');
    }

    // 1. getQuote (Optional but good for complete logs)
    const quoteReq = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getQuote">
    <caller/>
    <serviceParameters>
      <reservation carCategory="${CAR_CATEGORY}" contractID="${ETO_CONTRACT_ID}" type="C" chargesDetail="TRE">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
        <meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${ETO_VOUCHER_ID}"
                       businessAccount="${ETO_BA}" voucherCarCategory="${CAR_CATEGORY}"
                       voucherRentalDuration="2" voucherFullCredit="Y"/>
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`;
    await callXRS(quoteReq, "01_getQuote");

    // 2. bookReservation
    const bookReq = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${CAR_CATEGORY}" contractID="${ETO_CONTRACT_ID}" type="C"
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
              lastName="OnRequest"
              title="MR"
              driverID="12345678900"
              email="teste@europcar.com.br"
              phone="+5511999999999"/>
    </serviceParameters>
  </serviceRequest>
</message>`;
    
    const bookRes = await callXRS(bookReq, "02_bookReservation");
    
    // Extract reservation number
    const resMatch = bookRes && bookRes.match(/resNumber="([^"]+)"/);
    if (resMatch) {
        console.log(`\n✅ On Request Reservation created successfully: ${resMatch[1]}`);
    } else {
        console.log(`\n⚠️ Could not find resNumber in response.`);
    }
}

run();
