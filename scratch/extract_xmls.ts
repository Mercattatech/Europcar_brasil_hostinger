
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
  const actions = ['getCarCategories', 'getMultipleRates', 'getQuote', 'bookReservation'];
  const results = {};

  for (const action of actions) {
    const log = await prisma.logXRS.findFirst({
      where: { action },
      orderBy: { createdAt: 'desc' }
    });
    
    if (log) {
      results[action] = {
        request: log.xmlRequest,
        response: log.xmlResponse
      };
    }
  }

  const outputDir = path.join(process.cwd(), 'scratch/xml_logs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  for (const [action, content] of Object.entries(results)) {
    fs.writeFileSync(path.join(outputDir, `${action}_request.xml`), content.request);
    fs.writeFileSync(path.join(outputDir, `${action}_response.xml`), content.response);
  }

  console.log('XML logs saved to scratch/xml_logs');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
