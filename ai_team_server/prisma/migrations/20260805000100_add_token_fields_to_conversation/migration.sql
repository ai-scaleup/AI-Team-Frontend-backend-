-- Per-conversation token accounting.
--
-- Additive only: three nullable columns with no DEFAULT and no NOT NULL, so
-- Postgres applies this as a catalog-only change (no table rewrite). Existing
-- Conversation rows are untouched and their new columns read as NULL.
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "tokenLimit" INTEGER;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "tokenUsed" INTEGER;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "tokenLeft" INTEGER;
