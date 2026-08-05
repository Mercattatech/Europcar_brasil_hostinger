-- Migration: fix_contentblock_text_column
-- Altera a coluna value_ptBR de VARCHAR para TEXT
-- para suportar templates HTML grandes (com imagens Base64, JSON extensos, etc.)

ALTER TABLE "ContentBlock" ALTER COLUMN "value_ptBR" TYPE TEXT;
