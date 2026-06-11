
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.logXRS.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' }
  });

  logs.forEach(log => {
    console.log(`--- LOG ID: ${log.id} ---`);
    console.log(`Action: ${log.action}`);
    console.log(`Source: ${log.sourceFile}`);
    console.log(`Has Error: ${log.hasError}`);
    console.log(`Request:\n${log.xmlRequest}`);
    // console.log(`Response:\n${log.xmlResponse}`);
    console.log('\n');
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
