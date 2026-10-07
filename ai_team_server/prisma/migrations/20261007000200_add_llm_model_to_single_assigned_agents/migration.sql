-- Additive only: adds a nullable SingleAssignedAgent.llmModelId pointing at
-- the LlmModel catalog. Nothing existing is dropped, altered, or deleted, and
-- no existing SingleAssignedAgent row is updated: a null llmModelId means "the
-- default model" (Claude Sonnet 5). The legacy "AssignedAgent" compatibility
-- view is unaffected: Postgres fixes a view's column list when it is created.

-- AlterTable: nullable, no default, so existing rows are left as they are.
ALTER TABLE "SingleAssignedAgent" ADD COLUMN IF NOT EXISTS "llmModelId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SingleAssignedAgent_llmModelId_idx" ON "SingleAssignedAgent"("llmModelId");

-- AddForeignKey: deactivating a model never deletes it, but if a row were
-- ever removed by hand the grant falls back to the default instead of failing.
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SingleAssignedAgent_llmModelId_fkey') THEN
    ALTER TABLE "SingleAssignedAgent"
      ADD CONSTRAINT "SingleAssignedAgent_llmModelId_fkey"
      FOREIGN KEY ("llmModelId") REFERENCES "LlmModel"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$migration$;
