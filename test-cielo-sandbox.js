const CIELO_API_URL = "https://apisandbox.cieloecommerce.cielo.com.br/1/sales/";
const cieloHeaders = {
    "Content-Type": "application/json",
    "MerchantId": "09b9420b-4f0c-41cf-8320-12d7ad86df8e", // Is this a sandbox key?
    "MerchantKey": "bAC1VGHazcHEi5dIingeZneNNUaciwrr956APJbL"
};

async function test() {
    try {
        const res = await fetch(CIELO_API_URL, {
             method: 'POST',
             headers: cieloHeaders,
             body: JSON.stringify({
                 "MerchantOrderId": "ORDTEST123",
                 "Customer": { "Name": "Matheus Conti", "Identity": "28585814870" },
                 "Payment": {
                     "Type": "CreditCard", "Amount": 1000, "Installments": 1, "Capture": true,
                     "CreditCard": {
                         "CardNumber": "5162920000006145",
                         "Holder": "Matheus H D Conti",
                         "ExpirationDate": "01/2033",
                         "SecurityCode": "123",
                         "Brand": "Master"
                     }
                 }
             })
        });
        
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Response text:", text);
    } catch(e) {
        console.error(e);
    }
}
test();
