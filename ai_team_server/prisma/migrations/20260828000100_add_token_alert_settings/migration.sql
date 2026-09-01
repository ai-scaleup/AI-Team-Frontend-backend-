-- Additive only: creates the ApiModel enum and the TokenAlertSettings table.
-- Nothing existing is dropped, altered, or deleted.

-- CreateEnum
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApiModel') THEN
    CREATE TYPE "ApiModel" AS ENUM (
      'GPT_5',
      'GPT_5_MINI',
      'GPT_5_NANO',
      'GPT_4_1',
      'GPT_4_1_MINI',
      'GPT_4O',
      'GPT_4O_MINI',
      'O3',
      'O4_MINI'
    );
  END IF;
END
$migration$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TokenAlertSettings" (
    "id" TEXT NOT NULL,
    "scope" "TokenAlertScope" NOT NULL,
    "tokenLimit" INTEGER NOT NULL DEFAULT 0,
    "apiModel" "ApiModel" NOT NULL DEFAULT 'GPT_4O_MINI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenAlertSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TokenAlertSettings_tokenLimit_check" CHECK ("tokenLimit" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_token_alert_settings_scope" ON "TokenAlertSettings"("scope");

-- Seed one row per scope so the admin panel always has something to read.
-- ON CONFLICT DO NOTHING keeps a re-run from touching an admin's saved values.
INSERT INTO "TokenAlertSettings" ("id", "scope", "tokenLimit", "apiModel", "createdAt", "updatedAt")
VALUES
    ('token-alert-settings-conversation', 'CONVERSATION', 0, 'GPT_4O_MINI', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('token-alert-settings-monthly',      'MONTHLY',      0, 'GPT_4O_MINI', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
