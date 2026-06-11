const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lastLog = await prisma.logXRS.findFirst({
    where: { action: 'bookReservation' },
    orderBy: { createdAt: 'desc' }
  });

  if (!lastLog) {
    console.log("Nenhum log de reserva encontrado.");
    return;
  }

  console.log("=== XML REQUEST ===");
  console.log(lastLog.xmlRequest);
  console.log("\n=== XML RESPONSE ===");
  console.log(lastLog.xmlResponse);
}

main()
  .finally(() => prisma.$disconnect());
