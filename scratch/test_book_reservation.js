async function runTest() {
  const endpoint = 'https://applications-ptn.europcar.com/xrs/resxml';
  const callerCode = "1132581";
  const password = "27112025";

  // 1. SEARCH
  const gmrXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getMultipleRates">
    <serviceParameters>
      <reservation contractID="56935466" type="C">
        <checkout stationID="QCVC01" date="20260601" time="1000"/>
        <checkin stationID="QCVC01" date="20260603" time="1000"/>
      </reservation>
      <driver countryOfResidence="BR"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

  const gmrRes = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ callerCode, password, 'XML-Request': gmrXml })
  }).then(r => r.text());

  const rateIdMatch = gmrRes.match(/rateId="([^"]+)"/);
  if (!rateIdMatch) { console.log("Search failed:", gmrRes); return; }
  const rateId = rateIdMatch[1];

  // 2. BOOK MINIMALIST (Baseado no Item 7 da doc)
  const bookXml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="EDMR" rateId="${rateId}" contractID="56935466" type="C" chargesDetail="TRE">
        <checkout stationID="QCVC01" date="20260601" time="1000"/>
        <checkin stationID="QCVC01" date="20260603" time="1000"/>
        <meanOfPayment typeCode="VCH" voucherType="ETO" voucherID="${Date.now().toString().slice(-4)}" businessAccount="73675595" voucherCarCategory="EDMR" voucherRentalDuration="2"/>
      </reservation>
      <driver countryOfResidence="BR" firstName="MATHEUS" lastName="CONTI" />
    </serviceParameters>
  </serviceRequest>
</message>`;

  console.log("--- SENDING MINIMALIST BOOKING ---");
  const bookRes = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ callerCode, password, 'XML-Request': bookXml })
  }).then(r => r.text());

  console.log(bookRes);
}

runTest();
