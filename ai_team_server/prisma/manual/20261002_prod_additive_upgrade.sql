-- Production upgrade to the schema of the test platform (migrations
-- 20260910000100 .. 20261002000100), rewritten so that NOTHING is deleted.
--
-- The test migrations are replayed in order with these differences:
--   * no DROP TABLE and no DROP COLUMN. AgentGroup, AgentGroupItem,
--     AssignedGroup, MembershipTemplateGroup and the four threshold*Notified
--     columns of the agent-assignment table stay in the database, untouched.
--     The new code simply does not read them.
--   * AssignedAgent is renamed, not recreated, and a view with the old name and
--     the old column names is left behind so the server that is live right now
--     keeps working until the new code is deployed.
--   * the active MembershipTemplateGroup links are copied to
--     MembershipTemplateTeam, so memberships keep the teams they bundle.
--   * the compaction tables are created directly in their final shape, so the
--     later "remove" migration has nothing to drop.
--
-- Run by scripts/apply-prod-additive-upgrade (one transaction, row counts and
-- content fingerprints compared before COMMIT). Every statement is guarded and
-- the file is safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- 1. AssignedAgent -> SingleAssignedAgent        (20260910000100, no DROP COLUMN)
-- ─────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'AssignedAgent'
      AND c.relkind = 'r'
      AND n.nspname = current_schema()
  ) THEN
    ALTER TABLE "AssignedAgent" RENAME TO "SingleAssignedAgent";
  END IF;
END
$mig$;

DO $mig$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'SingleAssignedAgent'
      AND column_name = 'monthlyTokenLimit'
  ) THEN
    ALTER TABLE "SingleAssignedAgent" RENAME COLUMN "monthlyTokenLimit" TO "tokenLimit";
  END IF;
END
$mig$;

-- Postgres keeps index and constraint names when a table is renamed; Prisma
-- derives the names it expects from the model name.
DO $mig$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = '"SingleAssignedAgent"'::regclass
      AND conname LIKE 'AssignedAgent\_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE "SingleAssignedAgent" RENAME CONSTRAINT %I TO %I',
      r.conname,
      'SingleAssignedAgent' || substring(r.conname from 14)
    );
  END LOOP;

  FOR r IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = current_schema()
      AND c.relname LIKE 'AssignedAgent\_%'
  LOOP
    EXECUTE format(
      'ALTER INDEX %I RENAME TO %I',
      r.relname,
      'SingleAssignedAgent' || substring(r.relname from 14)
    );
  END LOOP;
END
$mig$;

-- Compatibility view for the server version that is deployed today: same name
-- and same 14 columns the old Prisma client queries. A single-table view is
-- automatically updatable, so its reads AND writes land on SingleAssignedAgent.
-- security_invoker makes it obey the caller's privileges on the base table.
-- It holds no data of its own and can be dropped once the new server is live.
DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'AssignedAgent' AND n.nspname = current_schema()
  ) THEN
    CREATE VIEW "AssignedAgent" WITH (security_invoker = true) AS
    SELECT "id",
           "userId",
           "agentName",
           "startsAt",
           "expiresAt",
           "durationDays",
           "isActive",
           "createdAt",
           "updatedAt",
           "tokenLimit" AS "monthlyTokenLimit",
           "threshold100Notified",
           "threshold50Notified",
           "threshold80Notified",
           "threshold90Notified"
    FROM "SingleAssignedAgent";
  END IF;
END
$mig$;

-- ─────────────────────────────────────────────────────────────
-- 2. Usage rollup on SingleAssignedAgent                     (20260910000200)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "SingleAssignedAgent"
    ADD COLUMN IF NOT EXISTS "usedTokens"   INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "inputTokens"  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "outputTokens" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "tokensLeft"   INTEGER;

UPDATE "SingleAssignedAgent"
SET "tokensLeft" = GREATEST(0, "tokenLimit" - "usedTokens")
WHERE "tokenLimit" IS NOT NULL
  AND "tokensLeft" IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. Team tier tables                                        (20260914000100)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AgentTeam" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTeam_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentTeamAgent" (
    "id"        TEXT NOT NULL,
    "teamId"    TEXT NOT NULL,
    "agentName" "AgentName" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTeamAgent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssignedTeam" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "teamId"       TEXT NOT NULL,
    "startsAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"    TIMESTAMP(3),
    "durationDays" INTEGER,
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "tokenLimit"   INTEGER,
    "usedTokens"   INTEGER NOT NULL DEFAULT 0,
    "inputTokens"  INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "tokensLeft"   INTEGER,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignedTeam_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentTeam_name_key" ON "AgentTeam"("name");
CREATE INDEX IF NOT EXISTS "AgentTeam_isActive_idx" ON "AgentTeam"("isActive");

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_agent_per_team" ON "AgentTeamAgent"("teamId", "agentName");
CREATE INDEX IF NOT EXISTS "AgentTeamAgent_teamId_idx" ON "AgentTeamAgent"("teamId");

CREATE INDEX IF NOT EXISTS "AssignedTeam_userId_isActive_idx" ON "AssignedTeam"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "AssignedTeam_teamId_idx" ON "AssignedTeam"("teamId");
CREATE INDEX IF NOT EXISTS "AssignedTeam_expiresAt_idx" ON "AssignedTeam"("expiresAt");

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AgentTeamAgent_teamId_fkey'
  ) THEN
    ALTER TABLE "AgentTeamAgent"
      ADD CONSTRAINT "AgentTeamAgent_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AssignedTeam_userId_fkey'
  ) THEN
    ALTER TABLE "AssignedTeam"
      ADD CONSTRAINT "AssignedTeam_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AssignedTeam_teamId_fkey'
  ) THEN
    ALTER TABLE "AssignedTeam"
      ADD CONSTRAINT "AssignedTeam_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$mig$;

-- ─────────────────────────────────────────────────────────────
-- 4. Copy the group tier into the team tier                  (20260914000150)
--    AgentGroup -> AgentTeam, AgentGroupItem -> AgentTeamAgent,
--    AssignedGroup -> AssignedTeam. Same ids. The source rows are NOT removed
--    (20260914000200_drop_agent_group_tables is deliberately not replayed).
-- ─────────────────────────────────────────────────────────────
DO $mig$
BEGIN
  IF to_regclass('"AgentGroup"') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO "AgentTeam" ("id", "name", "description", "isActive", "createdAt", "updatedAt")
  SELECT g."id",
         g."name",
         COALESCE(g."description", ''),
         g."isActive",
         g."createdAt",
         g."updatedAt"
  FROM "AgentGroup" g
  ON CONFLICT ("id") DO NOTHING;

  IF to_regclass('"AgentGroupItem"') IS NOT NULL THEN
    INSERT INTO "AgentTeamAgent" ("id", "teamId", "agentName", "createdAt")
    SELECT i."id", i."groupId", i."agentName", i."createdAt"
    FROM "AgentGroupItem" i
    JOIN "AgentTeam" t ON t."id" = i."groupId"
    ON CONFLICT ("teamId", "agentName") DO NOTHING;
  END IF;

  IF to_regclass('"AssignedGroup"') IS NOT NULL THEN
    INSERT INTO "AssignedTeam" (
      "id", "userId", "teamId", "startsAt", "expiresAt", "durationDays", "isActive",
      "tokenLimit", "usedTokens", "inputTokens", "outputTokens", "tokensLeft",
      "createdAt", "updatedAt"
    )
    SELECT a."id",
           a."userId",
           a."groupId",
           a."startsAt",
           a."expiresAt",
           a."durationDays",
           a."isActive",
           a."monthlyTokenLimit",
           0, 0, 0,
           a."monthlyTokenLimit",
           a."createdAt",
           a."updatedAt"
    FROM "AssignedGroup" a
    JOIN "AgentTeam" t ON t."id" = a."groupId"
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END
$mig$;

-- ─────────────────────────────────────────────────────────────
-- 5. Membership -> team link               (20260915000200, final shape only)
--    20260915000100 created MembershipTeam and 20260915000200 dropped it again;
--    neither table ever existed here, so only the final table is created.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "MembershipTemplateTeam" (
    "id"                   TEXT NOT NULL,
    "membershipTemplateId" TEXT NOT NULL,
    "teamId"               TEXT NOT NULL,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipTemplateTeam_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_team_per_membership_template"
    ON "MembershipTemplateTeam"("membershipTemplateId", "teamId");
CREATE INDEX IF NOT EXISTS "MembershipTemplateTeam_teamId_idx"
    ON "MembershipTemplateTeam"("teamId");

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MembershipTemplateTeam_membershipTemplateId_fkey'
  ) THEN
    ALTER TABLE "MembershipTemplateTeam"
      ADD CONSTRAINT "MembershipTemplateTeam_membershipTemplateId_fkey"
      FOREIGN KEY ("membershipTemplateId") REFERENCES "MembershipTemplate"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MembershipTemplateTeam_teamId_fkey'
  ) THEN
    ALTER TABLE "MembershipTemplateTeam"
      ADD CONSTRAINT "MembershipTemplateTeam_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$mig$;

-- Not in the test migrations: carry the groups a membership bundles today over
-- to the new link table. Only active links -- an inactive link is one an admin
-- already removed. The source rows stay in MembershipTemplateGroup.
DO $mig$
BEGIN
  IF to_regclass('"MembershipTemplateGroup"') IS NOT NULL THEN
    INSERT INTO "MembershipTemplateTeam" ("id", "membershipTemplateId", "teamId", "createdAt")
    SELECT l."id", l."membershipTemplateId", l."groupId", l."createdAt"
    FROM "MembershipTemplateGroup" l
    JOIN "AgentTeam" t ON t."id" = l."groupId"
    WHERE l."isActive"
    ON CONFLICT DO NOTHING;
  END IF;
END
$mig$;

-- ─────────────────────────────────────────────────────────────
-- 6. Default allowance on the team                           (20260918000100)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "AgentTeam"
    ADD COLUMN IF NOT EXISTS "tokenLimit" INTEGER;

-- ─────────────────────────────────────────────────────────────
-- 7. Per-agent slice of a team grant                         (20260918000200)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "AssignedTeamAgent" (
    "id"             TEXT NOT NULL,
    "assignedTeamId" TEXT NOT NULL,
    "agentName"      "AgentName" NOT NULL,
    "tokenLimit"     INTEGER,
    "usedTokens"     INTEGER NOT NULL DEFAULT 0,
    "inputTokens"    INTEGER NOT NULL DEFAULT 0,
    "outputTokens"   INTEGER NOT NULL DEFAULT 0,
    "tokensLeft"     INTEGER,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignedTeamAgent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_agent_per_assigned_team"
    ON "AssignedTeamAgent"("assignedTeamId", "agentName");
CREATE INDEX IF NOT EXISTS "AssignedTeamAgent_assignedTeamId_idx"
    ON "AssignedTeamAgent"("assignedTeamId");
CREATE INDEX IF NOT EXISTS "AssignedTeamAgent_agentName_idx"
    ON "AssignedTeamAgent"("agentName");

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AssignedTeamAgent_assignedTeamId_fkey'
  ) THEN
    ALTER TABLE "AssignedTeamAgent"
      ADD CONSTRAINT "AssignedTeamAgent_assignedTeamId_fkey"
      FOREIGN KEY ("assignedTeamId") REFERENCES "AssignedTeam"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$mig$;

-- Backfill 1: grants without their own limit inherit the team default.
UPDATE "AssignedTeam" AS g
   SET "tokenLimit" = t."tokenLimit"
  FROM "AgentTeam" AS t
 WHERE t."id" = g."teamId"
   AND g."tokenLimit" IS NULL
   AND t."tokenLimit" IS NOT NULL;

-- Backfill 2: one agent row per (grant, team agent).
INSERT INTO "AssignedTeamAgent"
    ("id", "assignedTeamId", "agentName", "tokenLimit", "usedTokens",
     "inputTokens", "outputTokens", "tokensLeft", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       g."id",
       a."agentName",
       g."tokenLimit",
       0, 0, 0,
       g."tokenLimit",
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
  FROM "AssignedTeam" AS g
  JOIN "AgentTeamAgent" AS a ON a."teamId" = g."teamId"
ON CONFLICT ("assignedTeamId", "agentName") DO NOTHING;

-- Backfill 3: the grant rollup is the sum of its agent rows.
UPDATE "AssignedTeam" AS g
   SET "usedTokens"   = s."used",
       "inputTokens"  = s."input",
       "outputTokens" = s."output",
       "tokensLeft"   = s."left"
  FROM (
        SELECT "assignedTeamId",
               COALESCE(SUM("usedTokens"), 0)::int   AS "used",
               COALESCE(SUM("inputTokens"), 0)::int  AS "input",
               COALESCE(SUM("outputTokens"), 0)::int AS "output",
               SUM("tokensLeft")::int                AS "left"
          FROM "AssignedTeamAgent"
         GROUP BY "assignedTeamId"
       ) AS s
 WHERE s."assignedTeamId" = g."id";

-- ─────────────────────────────────────────────────────────────
-- 8. Shared token pool on a membership grant                 (20260918000300)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "AssignedMembership"
  ADD COLUMN IF NOT EXISTS "cycleStartsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "usedTokens"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "inputTokens"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "outputTokens"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tokensLeft"    INTEGER;

UPDATE "AssignedMembership"
   SET "cycleStartsAt" = "startsAt"
 WHERE "cycleStartsAt" > CURRENT_TIMESTAMP - INTERVAL '1 minute';

UPDATE "AssignedMembership" AS m
   SET "tokensLeft" = GREATEST(0, COALESCE(m."monthlyTokenLimit", t."monthlyTokenLimit") - m."usedTokens")
  FROM "MembershipTemplate" AS t
 WHERE t."id" = m."membershipTemplateId"
   AND m."tokensLeft" IS NULL;

-- ─────────────────────────────────────────────────────────────
-- 9. Conversation compaction     (20260920000100 in the shape left by
--    20260929000100: no CompactionMemorySection, no retired policy columns)
-- ─────────────────────────────────────────────────────────────
DO $mig$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompactionOwnerType') THEN
        CREATE TYPE "CompactionOwnerType" AS ENUM ('GLOBAL', 'MEMBERSHIP', 'TEAM', 'AGENT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompactionSummaryStyle') THEN
        CREATE TYPE "CompactionSummaryStyle" AS ENUM ('STRUCTURED', 'PROSE');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompactionEventStatus') THEN
        CREATE TYPE "CompactionEventStatus" AS ENUM ('OK', 'FALLBACK', 'FAILED');
    END IF;
END
$mig$;

CREATE TABLE IF NOT EXISTS "CompactionSettings" (
    "id"                 TEXT NOT NULL,
    "ownerType"          "CompactionOwnerType" NOT NULL DEFAULT 'GLOBAL',
    "ownerId"            TEXT NOT NULL DEFAULT '',
    "enabled"            BOOLEAN NOT NULL DEFAULT true,
    "watermarkPercent"   INTEGER NOT NULL DEFAULT 75,
    "keepLastTurns"      INTEGER NOT NULL DEFAULT 8,
    "memoryCapTokens"    INTEGER NOT NULL DEFAULT 1200,
    "conversationBudget" INTEGER NOT NULL DEFAULT 24000,
    "summaryStyle"       "CompactionSummaryStyle" NOT NULL DEFAULT 'STRUCTURED',
    "apiModel"           "ApiModel" NOT NULL DEFAULT 'GPT_4O_MINI',
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompactionSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_compaction_settings_owner"
    ON "CompactionSettings"("ownerType", "ownerId");

CREATE TABLE IF NOT EXISTS "CompactionState" (
    "id"              TEXT NOT NULL,
    "sessionId"       TEXT NOT NULL,
    "chatId"          TEXT NOT NULL DEFAULT '',
    "agentName"       "AgentName" NOT NULL,
    "email"           TEXT,
    "title"           TEXT,
    "turnCount"       INTEGER NOT NULL DEFAULT 0,
    "liveTokens"      INTEGER NOT NULL DEFAULT 0,
    "totalTokens"     INTEGER NOT NULL DEFAULT 0,
    "compactionCount" INTEGER NOT NULL DEFAULT 0,
    "lastCompactedAt" TIMESTAMP(3),
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompactionState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_compaction_state_chat"
    ON "CompactionState"("sessionId", "chatId", "agentName");
CREATE INDEX IF NOT EXISTS "CompactionState_agentName_idx"
    ON "CompactionState"("agentName");
CREATE INDEX IF NOT EXISTS "CompactionState_updatedAt_idx"
    ON "CompactionState"("updatedAt");

CREATE TABLE IF NOT EXISTS "CompactionTurn" (
    "id"         TEXT NOT NULL,
    "stateId"    TEXT NOT NULL,
    "role"       TEXT NOT NULL,
    "text"       TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "compacted"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompactionTurn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CompactionTurn_stateId_createdAt_idx"
    ON "CompactionTurn"("stateId", "createdAt");
CREATE INDEX IF NOT EXISTS "CompactionTurn_stateId_compacted_idx"
    ON "CompactionTurn"("stateId", "compacted");

CREATE TABLE IF NOT EXISTS "CompactionSummary" (
    "id"              TEXT NOT NULL,
    "stateId"         TEXT NOT NULL,
    "version"         INTEGER NOT NULL,
    "content"         TEXT NOT NULL,
    "tokenCount"      INTEGER NOT NULL DEFAULT 0,
    "coversTurnCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompactionSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_summary_version_per_state"
    ON "CompactionSummary"("stateId", "version");
CREATE INDEX IF NOT EXISTS "CompactionSummary_stateId_idx"
    ON "CompactionSummary"("stateId");

CREATE TABLE IF NOT EXISTS "CompactionEvent" (
    "id"             TEXT NOT NULL,
    "stateId"        TEXT,
    "sessionId"      TEXT NOT NULL,
    "chatId"         TEXT NOT NULL DEFAULT '',
    "agentName"      "AgentName" NOT NULL,
    "email"          TEXT,
    "title"          TEXT,
    "tokensBefore"   INTEGER NOT NULL DEFAULT 0,
    "tokensAfter"    INTEGER NOT NULL DEFAULT 0,
    "turnsCompacted" INTEGER NOT NULL DEFAULT 0,
    "summaryTokens"  INTEGER NOT NULL DEFAULT 0,
    "costTokens"     INTEGER NOT NULL DEFAULT 0,
    "status"         "CompactionEventStatus" NOT NULL DEFAULT 'OK',
    "apiModel"       "ApiModel",
    "detail"         TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompactionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CompactionEvent_createdAt_idx"
    ON "CompactionEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "CompactionEvent_agentName_idx"
    ON "CompactionEvent"("agentName");
CREATE INDEX IF NOT EXISTS "CompactionEvent_sessionId_chatId_idx"
    ON "CompactionEvent"("sessionId", "chatId");

DO $mig$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CompactionTurn_stateId_fkey'
    ) THEN
        ALTER TABLE "CompactionTurn"
            ADD CONSTRAINT "CompactionTurn_stateId_fkey"
            FOREIGN KEY ("stateId") REFERENCES "CompactionState"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'CompactionSummary_stateId_fkey'
    ) THEN
        ALTER TABLE "CompactionSummary"
            ADD CONSTRAINT "CompactionSummary_stateId_fkey"
            FOREIGN KEY ("stateId") REFERENCES "CompactionState"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END
$mig$;

-- Seed the GLOBAL settings row, so the admin panel and the runtime both have
-- something to read before anyone saves.
INSERT INTO "CompactionSettings" ("id", "ownerType", "ownerId", "updatedAt")
VALUES ('compaction-settings-global', 'GLOBAL', '', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 10. LUCA agent                                             (20260920000200)
-- ─────────────────────────────────────────────────────────────
ALTER TYPE "AgentName" ADD VALUE IF NOT EXISTS 'LUCA';

-- ─────────────────────────────────────────────────────────────
-- 11. Daily spend of the team / single-agent tiers           (20260929000200)
-- ─────────────────────────────────────────────────────────────
DO $mig$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GrantUsageSource') THEN
        CREATE TYPE "GrantUsageSource" AS ENUM ('TEAM', 'SINGLE');
    END IF;
END
$mig$;

CREATE TABLE IF NOT EXISTS "GrantTokenUsageDaily" (
    "id"           TEXT NOT NULL,
    "oauthId"      TEXT NOT NULL,
    "agentName"    "AgentName" NOT NULL,
    "source"       "GrantUsageSource" NOT NULL,
    "date"         DATE NOT NULL,
    "inputTokens"  INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens"  INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrantTokenUsageDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_grant_token_usage_daily"
    ON "GrantTokenUsageDaily"("oauthId", "agentName", "source", "date");
CREATE INDEX IF NOT EXISTS "GrantTokenUsageDaily_date_idx"
    ON "GrantTokenUsageDaily"("date");

DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GrantTokenUsageDaily_oauthId_fkey'
  ) THEN
    ALTER TABLE "GrantTokenUsageDaily"
      ADD CONSTRAINT "GrantTokenUsageDaily_oauthId_fkey"
      FOREIGN KEY ("oauthId") REFERENCES "User"("oauthId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$mig$;

INSERT INTO "GrantTokenUsageDaily"
    ("id", "oauthId", "agentName", "source", "date",
     "inputTokens", "outputTokens", "totalTokens", "updatedAt")
SELECT gen_random_uuid()::text,
       u."oauthId",
       a."agentName",
       'TEAM'::"GrantUsageSource",
       a."updatedAt"::date,
       SUM(a."inputTokens"),
       SUM(a."outputTokens"),
       SUM(a."usedTokens"),
       CURRENT_TIMESTAMP
  FROM "AssignedTeamAgent" AS a
  JOIN "AssignedTeam" AS g ON g."id" = a."assignedTeamId"
  JOIN "User" AS u ON u."id" = g."userId"
 WHERE a."usedTokens" > 0
 GROUP BY u."oauthId", a."agentName", a."updatedAt"::date
ON CONFLICT ("oauthId", "agentName", "source", "date") DO NOTHING;

INSERT INTO "GrantTokenUsageDaily"
    ("id", "oauthId", "agentName", "source", "date",
     "inputTokens", "outputTokens", "totalTokens", "updatedAt")
SELECT gen_random_uuid()::text,
       u."oauthId",
       s."agentName",
       'SINGLE'::"GrantUsageSource",
       s."updatedAt"::date,
       SUM(s."inputTokens"),
       SUM(s."outputTokens"),
       SUM(s."usedTokens"),
       CURRENT_TIMESTAMP
  FROM "SingleAssignedAgent" AS s
  JOIN "User" AS u ON u."id" = s."userId"
 WHERE s."usedTokens" > 0
 GROUP BY u."oauthId", s."agentName", s."updatedAt"::date
ON CONFLICT ("oauthId", "agentName", "source", "date") DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 12. Backend-only compaction                                (20261002000100)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "CompactionState"
    ADD COLUMN IF NOT EXISTS "deliveredSummaryVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "CompactionSettings"
    ALTER COLUMN "watermarkPercent" SET DEFAULT 80,
    ALTER COLUMN "conversationBudget" SET DEFAULT 250000;

-- Only while the global row still holds the values it was seeded with, so a
-- re-run never overwrites what an admin saved in the panel.
UPDATE "CompactionSettings"
SET "watermarkPercent" = 80,
    "conversationBudget" = 250000,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "ownerType" = 'GLOBAL' AND "ownerId" = ''
  AND "watermarkPercent" = 75
  AND "conversationBudget" = 24000;
