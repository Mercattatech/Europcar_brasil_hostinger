/**
 * Run only Scenarios 4 and 5 (final Antonio tests)
 * Scenario 4: CID 56935495 (Zero Excess) - One Way AAHC01 → FRAL01
 * Scenario 5: CID 56935466 (With Excess) - Round-trip AAHC01 + NVS + Modify + Cancel
 */

const fs = require('fs');
const path = require('path');

const CALLER_CODE = "1132581";
const PASSWORD = "27112025";
const ENDPOINT = "https://applications-ptn.europcar.com/xrs/resxml";

const CONTRACTS = {
    "56935495": { ba: "73804373" },
    "56935466": { ba: "73675595" }
};
const VOUCHER_ID = "88889999";

async function callXRS(xmlRequest, action, logArray) {
    const payload = new URLSearchParams();
    payload.append('callerCode', CALLER_CODE);
    payload.append('password', PASSWORD);
    payload.append('XML-Request', xmlRequest);

    const block = `\n\n=== [${action}] REQUEST ===\n${xmlRequest}`;
    console.log(block);
    logArray.push(block);

    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: payload.toString()
        });
        const data = await response.text();
        const respBlock = `\n=== [${action}] RESPONSE ===\n${data}`;
        console.log(`[${action}] Response received.`);
        logArray.push(respBlock);
        return data;
    } catch (error) {
        const errBlock = `\n❌ [${action}] FAILED: ${error.message}`;
        console.error(errBlock);
        logArray.push(errBlock);
        return null;
    }
}

function extractAcrissCodesFromXml(xml) {
    const codes = [];
    const re = /carCategoryCode="([A-Z]{4})"/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
        if (!codes.includes(m[1])) codes.push(m[1]);
    }
    return codes;
}

function extractRateInfo(xml, targetCategory) {
    const categoryPattern = new RegExp(`carCategory="${targetCategory}"[^>]*rateId="([^"]+)"`, 'i');
    let m = categoryPattern.exec(xml);
    if (!m) {
        const categoryPattern2 = new RegExp(`rateId="([^"]+)"[^>]*carCategory="${targetCategory}"`, 'i');
        m = categoryPattern2.exec(xml);
    }
    if (m) return { rateId: m[1], category: targetCategory };

    const rateMatch = /rateId="([^"]+)"/.exec(xml);
    if (rateMatch) {
        const rateId = rateMatch[1];
        const tagMatch = new RegExp(`<reservation[^>]*rateId="${rateId}"[^>]*>`).exec(xml)
            || new RegExp(`<reservation[^>]*carCategory="([^"]+)"[^>]*rateId="${rateId}"`).exec(xml);
        let cat = targetCategory;
        if (tagMatch) {
            const catMatch = /carCategory="([^"]+)"/.exec(tagMatch[0]);
            if (catMatch) cat = catMatch[1];
        }
        return { rateId, category: cat };
    }
    return { rateId: null, category: targetCategory };
}

function extractExpectedCost(xml) {
    const m = /totalRateEstimateInBookingCurrency="([^"]+)"/.exec(xml)
        || /totalRateEstimate="([^"]+)"/.exec(xml);
    return m ? m[1] : "N/A";
}

async function runScenario(scenarioName, pickupStation, returnStation, extraEquipmentXml, outFile, contractId = "56935495") {
    const CID = contractId;
    const BA  = CONTRACTS[contractId]?.ba || "73804373";

    console.log(`\n\n===========================================`);
    console.log(`🚀 STARTING SCENARIO: ${scenarioName}`);
    console.log(`    CID: ${CID} | BA: ${BA}`);
    console.log(`    Route: ${pickupStation} → ${returnStation}`);
    console.log(`===========================================`);

    // Dynamic dates: pickup = 14 days from now, return = 16 days from now
    const now = new Date();
    const p = new Date(now); p.setDate(now.getDate() + 14);
    const r = new Date(now); r.setDate(now.getDate() + 16);
    const pad = (n) => String(n).padStart(2, '0');
    const PICKUP_DATE = `${p.getFullYear()}${pad(p.getMonth()+1)}${pad(p.getDate())}`;
    const RETURN_DATE = `${r.getFullYear()}${pad(r.getMonth()+1)}${pad(r.getDate())}`;
    const PICKUP_TIME = "1000";
    const RETURN_TIME = "1000";
    const duration = 2;

    console.log(`    Dates: ${PICKUP_DATE} → ${RETURN_DATE}`);

    const logArray = [];

    // Step 1: getCarCategories
    const catXml = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getCarCategories">
    <serviceContext>
      <localisation active="true">
        <language code="en_US"/>
      </localisation>
    </serviceContext>
    <serviceParameters>
      <reservation contractID="${CID}" type="C">
        <checkout stationID="${pickupStation}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${returnStation}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`, "ETO_getCarCategories", logArray);

    const acrissCodes = catXml ? extractAcrissCodesFromXml(catXml) : [];
    logArray.push(`\n// ACRISS codes extracted: ${acrissCodes.join(', ') || '(none)'}`);

    if (acrissCodes.length === 0) {
        logArray.push(`\n// ERROR: No ACRISS codes found. getCarCategories may have returned an error.`);
        const summary = `Scenario: ${scenarioName} | Cost: ERROR - No car categories`;
        console.log(`\n❌ ${summary}`);
        fs.writeFileSync(path.join(__dirname, outFile), summary + '\n\n' + logArray.join(''), 'utf8');
        return;
    }

    // Step 2: getMultipleRates (no equipment — Antonio confirmed it returns all by default)
    let rateId = null;
    let selectedCategory = acrissCodes[0];
    const chunkSize = 10;
    for (let i = 0; i < acrissCodes.length; i += chunkSize) {
        const chunk = acrissCodes.slice(i, i + chunkSize);
        const pattern = chunk.join(',');
        const ratesXml = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getMultipleRates">
    <serviceContext>
      <localisation active="true">
        <language code="en_US"/>
      </localisation>
    </serviceContext>
    <serviceParameters>
      <reservation carCategoryPattern="${pattern}" contractID="${CID}" type="C" chargesDetail="TRE" rateDetails="Y">
        <checkout stationID="${pickupStation}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${returnStation}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`, `ETO_getMultipleRates_chunk${Math.floor(i/chunkSize)+1}`, logArray);

        if (ratesXml && !rateId) {
            const info = extractRateInfo(ratesXml, acrissCodes[0]);
            if (info.rateId) {
                rateId = info.rateId;
                selectedCategory = info.category;
            }
        }
    }

    logArray.push(rateId
        ? `\n// rateId extracted: ${rateId} | category: ${selectedCategory}`
        : `\n// WARNING: rateId not extracted from getMultipleRates`
    );

    if (!rateId) {
        const summary = `Scenario: ${scenarioName} | Cost: ERROR - No rateId from getMultipleRates`;
        console.log(`\n❌ ${summary}`);
        fs.writeFileSync(path.join(__dirname, outFile), summary + '\n\n' + logArray.join(''), 'utf8');
        return;
    }

    // Step 3: getQuote
    await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getQuote">
    <serviceContext>
      <localisation active="true">
        <language code="en_US"/>
      </localisation>
    </serviceContext>
    <caller/>
    <serviceParameters>
      <reservation carCategory="${selectedCategory}" contractID="${CID}" type="C" chargesDetail="TRE" rateId="${rateId}" email="teste@europcar.com.br">
        <checkout stationID="${pickupStation}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${returnStation}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
        <meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${VOUCHER_ID}"
                       businessAccount="${BA}" voucherCarCategory="${selectedCategory}"
                       voucherRentalDuration="${duration}"/>
        <equipmentList>${extraEquipmentXml ? '\n          ' + extraEquipmentXml + '\n        ' : ''}</equipmentList>
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`, "ETO_getQuote", logArray);

    // Step 4: bookReservation
    const bookXml = await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceContext>
      <localisation active="true">
        <language code="en_US"/>
      </localisation>
    </serviceContext>
    <serviceParameters>
      <reservation carCategory="${selectedCategory}" contractID="${CID}" type="C"
                   chargesDetail="TRE" preferredLanguage="pt_BR" rateId="${rateId}" email="teste@europcar.com.br">
        <checkout stationID="${pickupStation}" date="${PICKUP_DATE}" time="${PICKUP_TIME}"/>
        <checkin stationID="${returnStation}" date="${RETURN_DATE}" time="${RETURN_TIME}"/>
        <equipmentList>${extraEquipmentXml ? '\n          ' + extraEquipmentXml + '\n        ' : ''}</equipmentList>
        <meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${VOUCHER_ID}"
                       businessAccount="${BA}" voucherCarCategory="${selectedCategory}"
                       voucherRentalDuration="${duration}"/>
      </reservation>
      <driver countryOfResidence="BR"
              firstName="Teste"
              lastName="Homologacao"
              title="MR"
              phoneNumber="+5511999999999"/>
    </serviceParameters>
  </serviceRequest>
</message>`, "ETO_bookReservation", logArray);

    const cost = bookXml ? extractExpectedCost(bookXml) : "N/A";
    const summary = `Scenario: ${scenarioName} | Cost: ${cost}`;
    console.log(`\n✅ ${summary}`);

    // Extract resNumber
    let reservationId = null;
    if (bookXml) {
        const resMatch = /resNumber="([^"]+)"/.exec(bookXml);
        if (resMatch) reservationId = resMatch[1];
    }
    console.log(reservationId ? `\n📋 resNumber: ${reservationId}` : `\n⚠️ resNumber NOT found`);

    // Step 5: Modify + Cancel (Scenario 5 only — per Antonio's spec)
    if (scenarioName === "5_Excess_Extras" && reservationId) {
        console.log(`\n===========================================`);
        console.log(`🔧 MODIFICATION for resNumber: ${reservationId}`);
        console.log(`===========================================`);

        // Per Antonio: only send modified field + driver name
        await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="modifyReservation">
    <serviceParameters>
      <reservation resNumber="${reservationId}">
        <checkout stationID="${pickupStation}" date="${PICKUP_DATE}" time="1200"/>
      </reservation>
      <driver countryOfResidence="BR" firstName="Teste" lastName="Homologacao" title="MR"/>
    </serviceParameters>
  </serviceRequest>
</message>`, "ETO_modifyReservation", logArray);

        console.log(`\n===========================================`);
        console.log(`❌ CANCELLATION for resNumber: ${reservationId}`);
        console.log(`===========================================`);

        await callXRS(`<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="cancelReservation">
    <serviceParameters>
      <reservation resNumber="${reservationId}"/>
    </serviceParameters>
  </serviceRequest>
</message>`, "ETO_cancelReservation", logArray);
    }

    fs.writeFileSync(path.join(__dirname, outFile), summary + '\n\n' + logArray.join(''), 'utf8');
    console.log(`\n📄 Log saved to: ${outFile}`);
}

async function main() {
    // Scenario 4: ONE WAY — CID 56935495 (Zero Excess) AAHC01 → FRAL01
    await runScenario("4_OneWay", "AAHC01", "FRAL01", null, "xml_scenario_4_oneway.txt", "56935495");

    // Scenario 5: CID 56935466 (With Excess) + NVS + Modify + Cancel
    await runScenario("5_Excess_Extras", "AAHC01", "AAHC01", '<equipment type="O" code="NVS" qty="1"/>', "xml_scenario_5_excess_extras.txt", "56935466");

    console.log("\n\n✅ All final scenarios finished!");
}

main();
