const axios = require('axios');

const CALLER_CODE = "1132581";
const PASSWORD = "27112025";
const ENDPOINT = "https://applications-ptn.europcar.com/xrs/resxml";

async function callXRS(xmlRequest) {
    const payload = new URLSearchParams();
    payload.append('callerCode', CALLER_CODE);
    payload.append('password', PASSWORD);
    payload.append('XML-Request', xmlRequest);

    try {
        const response = await axios.post(ENDPOINT, payload.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 20000,
        });
        return response.data;
    } catch (error) {
        console.error("FAILED:", error.response?.data || error.message);
    }
}

async function run() {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="getCarCategories">
    <serviceParameters>
      <reservation contractID="56935466" type="C">
        <checkout stationID="GRUO02" date="20260615" time="1000"/>
        <checkin stationID="GRUO02" date="20260617" time="1000"/>
      </reservation>
    </serviceParameters>
  </serviceRequest>
</message>`;
    const res = await callXRS(xml);
    console.log(res);
}

run();
