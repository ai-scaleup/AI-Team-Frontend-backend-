-- Additive only: creates two NEW tables for agency memberships (the plans an
-- agency can buy seat pools of) and their link to AgentTeam. No existing
-- table, column or row is dropped, altered, updated or deleted.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyMembership" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "includedAgents" "AgentName"[],
    "monthlyTokenLimit" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyMembershipTeam" (
    "id" TEXT NOT NULL,
    "agencyMembershipId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyMembershipTeam_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgencyMembership_archivedAt_idx" ON "AgencyMembership"("archivedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgencyMembershipTeam_teamId_idx" ON "AgencyMembershipTeam"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_team_per_agency_membership" ON "AgencyMembershipTeam"("agencyMembershipId", "teamId");

-- AddForeignKey: both cascades only remove link rows in AgencyMembershipTeam.
-- Agency memberships themselves are archived, never deleted.
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyMembershipTeam_agencyMembershipId_fkey') THEN
    ALTER TABLE "AgencyMembershipTeam"
      ADD CONSTRAINT "AgencyMembershipTeam_agencyMembershipId_fkey"
      FOREIGN KEY ("agencyMembershipId") REFERENCES "AgencyMembership"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyMembershipTeam_teamId_fkey') THEN
    ALTER TABLE "AgencyMembershipTeam"
      ADD CONSTRAINT "AgencyMembershipTeam_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "AgentTeam"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$migration$;
