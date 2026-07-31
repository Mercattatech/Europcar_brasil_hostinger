-- AlterTable: Adiciona campos obrigatórios para autenticação 3DS 2.2 (Cielo API 3.0)
-- EstablishmentCode (605), MerchantName (606) e MCC (607)
ALTER TABLE "CieloConfig" ADD COLUMN IF NOT EXISTS "establishmentCode" TEXT;
ALTER TABLE "CieloConfig" ADD COLUMN IF NOT EXISTS "merchantName"      TEXT;
ALTER TABLE "CieloConfig" ADD COLUMN IF NOT EXISTS "mcc"               TEXT;
