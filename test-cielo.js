const CIELO_API_URL = "https://apisandbox.cieloecommerce.cielo.com.br/1/sales/";
const cieloHeaders = {
    "Content-Type": "application/json",
    "MerchantId": "sandbox", // use fake or let it fail 
    "MerchantKey": "sandbox"
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
