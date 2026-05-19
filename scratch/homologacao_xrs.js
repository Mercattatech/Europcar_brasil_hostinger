
const axios = require('axios');

const CALLER_CODE = "1132581";
const PASSWORD = "27112025";
const ENDPOINT = "https://applications-ptn.europcar.com/xrs/resxml";

async function callXRS(xmlRequest, action) {
    const payload = new URLSearchParams();
    payload.append('callerCode', CALLER_CODE);
    payload.append('password', PASSWORD);
    payload.append('XML-Request', xmlRequest);

    console.log(`\n\n=== [${action}] REQUEST ===\n${xmlRequest}`);

    try {
        const response = await axios.post(ENDPOINT, payload.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 20000,
        });
        console.log(`\n=== [${action}] RESPONSE ===\n${response.data}`);
        return response.data;
    } catch (error) {
        console.error(`\n❌ [${action}] FAILED:`, error.response?.data || error.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PARÂMETROS COMUNS
// ─────────────────────────────────────────────────────────────────────────────
const PICKUP_STATION = "GRUO02";
const RETURN_STATION = "GRUO02";
const PICKUP_DATE    = "20260615";
const RETURN_DATE    = "20260617";
const PICKUP_TIME    = "1000";
const RETURN_TIME    = "1000";
const CAR_CATEGORY   = "EDMR";

// ETO contract details (CID → BA mapping provided by Ewa)
const ETO_CONTRACT_ID = "56935466";
const ETO_BA          = "73675595";
const ETO_VOUCHER_ID  = "88889999"; // numeric, as required

// ─────────────────────────────────────────────────────────────────────────────
// FLUXO CC / POA  (sem meanOfPayment no getQuote, conforme instrução da Europcar)
// ─────────────────────────────────────────────────────────────────────────────
async function testCCFlow() {
    console.log("\n\n========================================");
    console.log("  FLUXO CC / POA");
    console.log("========================================");

    // 1. getCarCategories
    await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getCarCategories">
    <serviceParameters>
      <reservation contractID="${ETO_CONTRACT_ID}" type="C">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`, "CC_getCarCategories");

    // 2. getQuote sem meanOfPayment (typeCode CARD não é necessário para CC POA)
    await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getQuote">
    <caller/>
    <serviceParameters>
      <reservation carCategory="${CAR_CATEGORY}" contractID="${ETO_CONTRACT_ID}" type="C" chargesDetail="TRE">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`, "CC_getQuote");

    // 3. bookReservation CC (BALCÃO — sem MOP)
    await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${CAR_CATEGORY}" contractID="${ETO_CONTRACT_ID}" type="C"
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
}

// ─────────────────────────────────────────────────────────────────────────────
// FLUXO ETO VOUCHER  (fluxo separado, somente com ETO MOP)
// ─────────────────────────────────────────────────────────────────────────────
async function testETOFlow() {
    console.log("\n\n========================================");
    console.log("  FLUXO ETO VOUCHER");
    console.log("========================================");

    // 1. getCarCategories (mesmo XML do CC — categorias independem de MOP)
    await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getCarCategories">
    <serviceParameters>
      <reservation contractID="${ETO_CONTRACT_ID}" type="C">
        <checkout stationID="${PICKUP_STATION}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${RETURN_STATION}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`, "ETO_getCarCategories");

    // 2. getQuote com ETO MOP (único getQuote neste fluxo)
    await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
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
</message>`, "ETO_getQuote");

    // 3. bookReservation ETO
    await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
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
                       voucherRentalDuration="2"/>
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
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTAR STATUS (On Request — search.searchbyid)
// ─────────────────────────────────────────────────────────────────────────────
async function testSearchById(resNumber) {
    console.log("\n\n========================================");
    console.log(`  search.searchbyid — ${resNumber}`);
    console.log("========================================");

    await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="search.searchbyid">
    <serviceParameters>
      <reservation resNumber="${resNumber}" />
    </serviceParameters>
  </serviceRequest>
</message>`, `searchById_${resNumber}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTRYPOINT — edite aqui o que quer testar
// ─────────────────────────────────────────────────────────────────────────────
async function run() {
    // Descomentar o fluxo desejado:
    await testCCFlow();
    // await testETOFlow();
    // await testSearchById("SEU_RES_NUMBER_AQUI");

    console.log("\n\n✅ TESTES FINALIZADOS.");
}

run();
