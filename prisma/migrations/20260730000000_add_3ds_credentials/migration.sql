-- AlterTable: Adiciona credenciais exclusivas para autenticação 3DS 2.2 (Braspag MPI)
ALTER TABLE "CieloConfig" ADD COLUMN IF NOT EXISTS "clientId3ds" TEXT;
ALTER TABLE "CieloConfig" ADD COLUMN IF NOT EXISTS "clientSecret3ds" TEXT;
