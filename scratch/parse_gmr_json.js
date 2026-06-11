const { PrismaClient } = require('@prisma/client');
const xml2js = require('xml2js');
const prisma = new PrismaClient();

async function main() {
  const lastLog = await prisma.logXRS.findFirst({
    where: { action: 'getMultipleRates' },
    orderBy: { createdAt: 'desc' }
  });

  if (!lastLog) return;

  const parser = new xml2js.Parser({ explicitArray: false });
  const result = await parser.parseStringPromise(lastLog.xmlResponse);
  
  const rates = result.message.serviceResponse.reservationRateList.reservationRate;
  console.log(JSON.stringify(Array.isArray(rates) ? rates[0] : rates, null, 2));
}

main()
  .finally(() => prisma.$disconnect());
