
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const successLogs = await prisma.logXRS.findMany({
        where: {
            hasError: false,
            action: 'getMultipleRates'
        },
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log(JSON.stringify(successLogs, null, 2));
}

main().finally(() => prisma.$disconnect());
