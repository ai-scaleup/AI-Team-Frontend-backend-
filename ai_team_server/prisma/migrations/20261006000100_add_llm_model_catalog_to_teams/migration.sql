-- Additive only: creates the LlmModel catalog, seeds it with Anthropic models,
-- and adds a nullable AgentTeam.llmModelId. Nothing existing is dropped,
-- altered, or deleted, and no existing AgentTeam row is updated: a null
-- llmModelId means "the default model" (Claude Sonnet 5).

-- CreateTable
CREATE TABLE IF NOT EXISTS "LlmModel" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmModel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LlmModel_provider_modelId_key" ON "LlmModel"("provider", "modelId");
CREATE INDEX IF NOT EXISTS "LlmModel_isActive_idx" ON "LlmModel"("isActive");

-- Seed the Anthropic models. ON CONFLICT DO NOTHING keeps a re-run from
-- touching rows an admin may have changed since.
INSERT INTO "LlmModel" ("id", "provider", "modelId", "label", "isActive", "isDefault", "sortOrder", "createdAt", "updatedAt")
VALUES
    ('llm-anthropic-claude-fable-5-1',  'anthropic', 'claude-fable-5-1',  'Claude Fable 5.1',  true, false, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('llm-anthropic-claude-opus-5-5',   'anthropic', 'claude-opus-5-5',   'Claude Opus 5.5',   true, false, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('llm-anthropic-claude-opus-5',     'anthropic', 'claude-opus-5',     'Claude Opus 5',     true, false, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('llm-anthropic-claude-sonnet-5-5', 'anthropic', 'claude-sonnet-5-5', 'Claude Sonnet 5.5', true, false, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('llm-anthropic-claude-sonnet-5',   'anthropic', 'claude-sonnet-5',   'Claude Sonnet 5',   true, true,  50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('llm-anthropic-claude-sonnet-4-6', 'anthropic', 'claude-sonnet-4-6', 'Claude Sonnet 4.6', true, false, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('llm-anthropic-claude-haiku-4-5',  'anthropic', 'claude-haiku-4-5',  'Claude Haiku 4.5',  true, false, 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- AlterTable: nullable, no default, so existing rows are left as they are.
ALTER TABLE "AgentTeam" ADD COLUMN IF NOT EXISTS "llmModelId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgentTeam_llmModelId_idx" ON "AgentTeam"("llmModelId");

-- AddForeignKey: deactivating a model never deletes it, but if a row were
-- ever removed by hand the team falls back to the default instead of failing.
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgentTeam_llmModelId_fkey') THEN
    ALTER TABLE "AgentTeam"
      ADD CONSTRAINT "AgentTeam_llmModelId_fkey"
      FOREIGN KEY ("llmModelId") REFERENCES "LlmModel"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$migration$;
