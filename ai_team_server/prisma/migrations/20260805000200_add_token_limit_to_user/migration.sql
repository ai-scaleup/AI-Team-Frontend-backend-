-- Per-user token allowance, inherited by every conversation created afterwards.
--
-- Additive: one nullable column with no DEFAULT and no NOT NULL, so Postgres
-- applies this as a catalog-only change (no table rewrite).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tokenLimit" INTEGER;

-- Backfill from what the conversations already say. Until now a user's limit
-- existed only as the same value repeated across their conversations, so adopt
-- that value as the stored allowance -- but only where every conversation
-- agrees on it. A user whose conversations carry different limits, or none at
-- all, has no single limit to inherit and is left NULL rather than guessed at.
UPDATE "User" AS u
SET "tokenLimit" = agreed."tokenLimit"
FROM (
  SELECT "userId", MIN("tokenLimit") AS "tokenLimit"
  FROM "Conversation"
  GROUP BY "userId"
  HAVING COUNT(*) = COUNT("tokenLimit")
     AND MIN("tokenLimit") = MAX("tokenLimit")
) AS agreed
WHERE u."id" = agreed."userId"
  AND u."tokenLimit" IS NULL;
