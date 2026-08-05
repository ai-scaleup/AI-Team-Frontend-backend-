-- Denormalize User.email onto UserPreference.
--
-- Written idempotently: parts of this were already applied to production by an
-- earlier `prisma db push`, so every statement must tolerate already existing.
ALTER TABLE "UserPreference" ADD COLUMN IF NOT EXISTS "email" TEXT;

-- Backfill ONLY rows missing an email. The `email IS NULL` guard matters: without
-- it this overwrites every existing UserPreference.email from User, discarding any
-- value that legitimately differs.
UPDATE "UserPreference" AS preference
SET "email" = "User"."email"
FROM "User"
WHERE preference."oauthId" = "User"."oauthId"
  AND preference."email" IS NULL;

ALTER TABLE "UserPreference" ALTER COLUMN "email" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "UserPreference_email_idx" ON "UserPreference"("email");
