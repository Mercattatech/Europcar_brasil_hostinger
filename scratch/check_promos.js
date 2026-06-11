
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const promos = await prisma.promotion.findMany({
        where: { status: 'ACTIVE' }
    });
    console.log(JSON.stringify(promos, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
