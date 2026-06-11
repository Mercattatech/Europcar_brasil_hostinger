// Run this with: node scratch/run_migration.cjs
// Uses the compiled Prisma client (already present) — no binary download needed

const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Running migration...');

  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS phone TEXT`);
  console.log('✅ Added: User.phone');

  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS city TEXT`);
  console.log('✅ Added: User.city');

  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS cpf TEXT`);
  console.log('✅ Added: User.cpf');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      "expiresAt" TIMESTAMP NOT NULL,
      used BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  console.log('✅ Created: PasswordResetToken');

  console.log('\n🎉 Migration complete!');
}

main()
  .catch(e => { console.error('❌ Migration failed:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
