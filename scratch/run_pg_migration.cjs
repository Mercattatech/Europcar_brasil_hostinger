const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.xgpbrwdetsgimrmaxayv:Mercatta%402022@aws-1-us-east-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to DB');

    await client.query(`
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS phone TEXT;
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS city TEXT;
      ALTER TABLE "User" ADD COLUMN IF NOT EXISTS cpf TEXT;
      
      CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        used BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('Migration OK');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await client.end();
  }
}

run();
