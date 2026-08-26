-- CreateTable: CustomerJourney — rastreamento do funil de conversão
CREATE TABLE IF NOT EXISTS "CustomerJourney" (
    "id"                TEXT NOT NULL,
    "sessionId"         TEXT NOT NULL,
    "userId"            TEXT,
    "pickupStation"     TEXT,
    "pickupStationName" TEXT,
    "returnStation"     TEXT,
    "returnStationName" TEXT,
    "pickupDate"        TEXT,
    "returnDate"        TEXT,
    "pickupTime"        TEXT,
    "returnTime"        TEXT,
    "country"           TEXT,
    "contractID"        TEXT,
    "selectedCar"       TEXT,
    "selectedCarName"   TEXT,
    "carPrice"          DOUBLE PRECISION,
    "selectedExtras"    JSONB,
    "paymentMethod"     TEXT,
    "resNumber"         TEXT,
    "currentStep"       INTEGER NOT NULL DEFAULT 1,
    "status"            TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "abandonedAt"       TEXT,
    "userAgent"         TEXT,
    "ipAddress"         TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerJourney_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CustomerJourney_sessionId_idx" ON "CustomerJourney"("sessionId");
CREATE INDEX IF NOT EXISTS "CustomerJourney_status_idx"    ON "CustomerJourney"("status");
CREATE INDEX IF NOT EXISTS "CustomerJourney_createdAt_idx" ON "CustomerJourney"("createdAt");
CREATE INDEX IF NOT EXISTS "CustomerJourney_currentStep_idx" ON "CustomerJourney"("currentStep");
