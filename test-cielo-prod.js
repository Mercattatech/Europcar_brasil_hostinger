const CIELO_API_URL = "https://api.cieloecommerce.cielo.com.br/1/sales/";
const cieloHeaders = {
    "Content-Type": "application/json",
    "MerchantId": "09b9420b-4f0c-41cf-8320-12d7ad86df8e", 
    "MerchantKey": "bAC1VGHazcHEi5dIingeZneNNUaciwrr956APJbL"
};

async function test() {
    try {
        const res = await fetch(CIELO_API_URL, {
             method: 'POST',
             headers: cieloHeaders,
             body: JSON.stringify({
                 "MerchantOrderId": "ORD123",
                 "Customer": { "Name": "TESTE", "Identity": "12312312312" },
                 "Payment": {
                     "Type": "CreditCard", "Amount": 1000, "Installments": 1, "Capture": true,
                     "CreditCard": {
                         "CardNumber": "0000000000000001",
                         "Holder": "TESTE",
                         "ExpirationDate": "12/2030",
                         "SecurityCode": "123",
                         "brand": "Visa"
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
