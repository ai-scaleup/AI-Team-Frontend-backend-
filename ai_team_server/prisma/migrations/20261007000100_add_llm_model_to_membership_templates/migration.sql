-- Additive only: adds a nullable MembershipTemplate.llmModelId pointing at the
-- LlmModel catalog. Nothing existing is dropped, altered, or deleted, and no
-- existing MembershipTemplate row is updated: a null llmModelId means "the
-- default model" (Claude Sonnet 5).

-- AlterTable: nullable, no default, so existing rows are left as they are.
ALTER TABLE "MembershipTemplate" ADD COLUMN IF NOT EXISTS "llmModelId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MembershipTemplate_llmModelId_idx" ON "MembershipTemplate"("llmModelId");

-- AddForeignKey: deactivating a model never deletes it, but if a row were
-- ever removed by hand the membership falls back to the default instead of
-- failing.
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MembershipTemplate_llmModelId_fkey') THEN
    ALTER TABLE "MembershipTemplate"
      ADD CONSTRAINT "MembershipTemplate_llmModelId_fkey"
      FOREIGN KEY ("llmModelId") REFERENCES "LlmModel"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$migration$;
