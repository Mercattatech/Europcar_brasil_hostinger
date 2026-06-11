const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lastLog = await prisma.logXRS.findFirst({
    where: { action: 'getMultipleRates' },
    orderBy: { createdAt: 'desc' }
  });

  if (!lastLog) {
    console.log("Nenhum log de GMR encontrado.");
    return;
  }

  console.log("=== XML RESPONSE (GMR) ===");
  console.log(lastLog.xmlResponse);
}

main()
  .finally(() => prisma.$disconnect());
