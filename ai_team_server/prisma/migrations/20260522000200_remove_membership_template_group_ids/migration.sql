-- Drop the unused MembershipTemplate.includedGroupIds column.
--
-- Verified before applying: the column exists but holds an empty array for every
-- row, so nothing is lost. IF EXISTS keeps the migration re-runnable.
ALTER TABLE "MembershipTemplate"
DROP COLUMN IF EXISTS "includedGroupIds";
