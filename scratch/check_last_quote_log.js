const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lastLog = await prisma.logXRS.findFirst({
    where: { action: 'getQuote' },
    orderBy: { createdAt: 'desc' }
  });

  if (!lastLog) {
    console.log("Nenhum log de getQuote encontrado.");
    return;
  }

  console.log("=== XML REQUEST (getQuote) ===");
  console.log(lastLog.xmlRequest);
  console.log("\n=== XML RESPONSE (getQuote) ===");
  console.log(lastLog.xmlResponse);
}

main()
  .finally(() => prisma.$disconnect());
