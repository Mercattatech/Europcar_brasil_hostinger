const bookingData = {
  car: {
    carCategoryCode: 'EDMR',
    rateId: 'RATE_123',
    totalRateEstimateInBookingCurrency: '100.00'
  },
  pickupDate: '20261201',
  pickupTime: '1000',
  returnDate: '20261205',
  returnTime: '1000',
  pickupStation: 'LIS',
  returnStation: 'LIS',
  contractID: '12345678',
};

const customerData = {
  nome: 'Teste',
  sobrenome: 'Fidelidade',
  cpf: '12345678900',
  email: 'teste@europcar.com',
  telefone: '11999999999',
  loyaltyProgramId: 'PRIV',
  loyaltyId: '1234567890'
};

const paymentData = {
  method: 'BALCAO'
};

const carCategory = bookingData.car.carCategoryCode;
const rateId = bookingData.car.rateId;
const pickupStation = bookingData.pickupStation;
const pickupDate = bookingData.pickupDate;
const returnStation = bookingData.returnStation;
const returnDate = bookingData.returnDate;
const contractID = bookingData.contractID;

const prepaidAttr = paymentData.method === 'VOUCHER' ? '' : ' prepaidMode="NP"';
const contractAttr = contractID ? ` contractID="${contractID}" type="C"` : '';
const productDataAttr = '';
const meanOfPaymentXml = '';

const { loyaltyProgramId, loyaltyId } = customerData;
let loyaltyXml = '';
if (loyaltyProgramId && loyaltyId) {
  loyaltyXml = `\n        <loyaltyProgram programId="${loyaltyProgramId}" loyaltyID="${loyaltyId}"/>`;
}

const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<message>
  <serviceRequest serviceCode="bookReservation">
    <serviceParameters>
      <reservation carCategory="${carCategory}" rateId="${rateId}"${prepaidAttr}${contractAttr}${productDataAttr} preferredLanguage="pt_BR">
        <checkout stationID="${pickupStation}" date="${pickupDate}" time="${bookingData.pickupTime || '1000'}"/>
        <checkin stationID="${returnStation}" date="${returnDate}" time="${bookingData.returnTime || '1000'}"/>
        <equipmentList/>${meanOfPaymentXml}${loyaltyXml}
      </reservation>
      <driver countryOfResidence="BR"
              firstName="${customerData.nome.trim()}"
              lastName="${customerData.sobrenome.trim()}"
              title="MR"
              driverID="${customerData.cpf.replace(/\D/g, '').slice(0, 11)}"
              email="${customerData.email.trim()}"
              phone="${customerData.telefone}"/>
    </serviceParameters>
  </serviceRequest>
</message>`;

console.log("=== XML GERADO PARA O BOOKRESERVATION COM FIDELIDADE ===");
console.log(xmlRequest);
