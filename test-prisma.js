require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const configs = await prisma.cieloConfig.findMany();
  console.log(JSON.stringify(configs, null, 2));
}
test().catch(console.error).finally(() => prisma.$disconnect());
