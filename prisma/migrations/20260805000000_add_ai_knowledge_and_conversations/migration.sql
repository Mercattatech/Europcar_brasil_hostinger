-- Migration: add_ai_knowledge_and_conversations
-- Adds AIKnowledgeDoc, AIConversationLog models and masterPrompt field to AIAgentConfig

-- Add masterPrompt to AIAgentConfig
ALTER TABLE "AIAgentConfig" ADD COLUMN IF NOT EXISTS "masterPrompt" TEXT;

-- Create AIKnowledgeDoc table
CREATE TABLE IF NOT EXISTS "AIKnowledgeDoc" (
    "id"            TEXT NOT NULL,
    "fileName"      TEXT NOT NULL,
    "fileType"      TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "active"        BOOLEAN NOT NULL DEFAULT true,
    "sizeBytes"     INTEGER DEFAULT 0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIKnowledgeDoc_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AIKnowledgeDoc_active_idx" ON "AIKnowledgeDoc"("active");

-- Create AIConversationLog table
CREATE TABLE IF NOT EXISTS "AIConversationLog" (
    "id"           TEXT NOT NULL,
    "sessionId"    TEXT NOT NULL,
    "messages"     TEXT NOT NULL,
    "approved"     BOOLEAN NOT NULL DEFAULT false,
    "sessionStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIConversationLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AIConversationLog_approved_idx" ON "AIConversationLog"("approved");
CREATE INDEX IF NOT EXISTS "AIConversationLog_sessionStart_idx" ON "AIConversationLog"("sessionStart");
