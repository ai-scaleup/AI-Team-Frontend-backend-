-- Additive only: creates three NEW enum types and six NEW tables for agencies
-- (seat pools, seat ledger, customers, staff, activity log). No existing
-- table, column, type or row is dropped, altered, updated or deleted.
-- Every foreign key is ON DELETE RESTRICT: nothing in here cascades.

-- CreateEnum
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AgencyStatus') THEN
    CREATE TYPE "AgencyStatus" AS ENUM ('ACTIVE', 'GRACE', 'SUSPENDED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AgencyCustomerStatus') THEN
    CREATE TYPE "AgencyCustomerStatus" AS ENUM ('ACTIVE', 'INVITED', 'ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AgencyStaffRole') THEN
    CREATE TYPE "AgencyStaffRole" AS ENUM ('OWNER', 'MANAGER', 'OPERATOR', 'VIEWER');
  END IF;
END
$migration$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "country" TEXT,
    "status" "AgencyStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencySeatPool" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "agencyMembershipId" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencySeatPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencySeatLedgerEntry" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "change" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencySeatLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyCustomer" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "AgencyCustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "cycleStartsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedTokens" INTEGER NOT NULL DEFAULT 0,
    "lastActiveAt" TIMESTAMP(3),
    "swappedInAt" TIMESTAMP(3),
    "replacesId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyStaff" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "AgencyStaffRole" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyActivity" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "actingAs" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Agency_archivedAt_idx" ON "Agency"("archivedAt");
CREATE INDEX IF NOT EXISTS "AgencySeatPool_agencyId_idx" ON "AgencySeatPool"("agencyId");
CREATE INDEX IF NOT EXISTS "AgencySeatPool_agencyMembershipId_idx" ON "AgencySeatPool"("agencyMembershipId");
CREATE INDEX IF NOT EXISTS "AgencySeatLedgerEntry_agencyId_createdAt_idx" ON "AgencySeatLedgerEntry"("agencyId", "createdAt");
CREATE INDEX IF NOT EXISTS "AgencySeatLedgerEntry_poolId_idx" ON "AgencySeatLedgerEntry"("poolId");
CREATE INDEX IF NOT EXISTS "AgencyCustomer_agencyId_status_idx" ON "AgencyCustomer"("agencyId", "status");
CREATE INDEX IF NOT EXISTS "AgencyCustomer_poolId_status_idx" ON "AgencyCustomer"("poolId", "status");
CREATE INDEX IF NOT EXISTS "AgencyCustomer_email_idx" ON "AgencyCustomer"("email");
CREATE INDEX IF NOT EXISTS "AgencyStaff_agencyId_idx" ON "AgencyStaff"("agencyId");
CREATE INDEX IF NOT EXISTS "AgencyStaff_email_idx" ON "AgencyStaff"("email");
CREATE INDEX IF NOT EXISTS "AgencyActivity_agencyId_createdAt_idx" ON "AgencyActivity"("agencyId", "createdAt");

-- AddForeignKey (all RESTRICT: deleting a parent row is refused, never cascaded)
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencySeatPool_agencyId_fkey') THEN
    ALTER TABLE "AgencySeatPool" ADD CONSTRAINT "AgencySeatPool_agencyId_fkey"
      FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencySeatPool_agencyMembershipId_fkey') THEN
    ALTER TABLE "AgencySeatPool" ADD CONSTRAINT "AgencySeatPool_agencyMembershipId_fkey"
      FOREIGN KEY ("agencyMembershipId") REFERENCES "AgencyMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencySeatLedgerEntry_agencyId_fkey') THEN
    ALTER TABLE "AgencySeatLedgerEntry" ADD CONSTRAINT "AgencySeatLedgerEntry_agencyId_fkey"
      FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencySeatLedgerEntry_poolId_fkey') THEN
    ALTER TABLE "AgencySeatLedgerEntry" ADD CONSTRAINT "AgencySeatLedgerEntry_poolId_fkey"
      FOREIGN KEY ("poolId") REFERENCES "AgencySeatPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyCustomer_agencyId_fkey') THEN
    ALTER TABLE "AgencyCustomer" ADD CONSTRAINT "AgencyCustomer_agencyId_fkey"
      FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyCustomer_poolId_fkey') THEN
    ALTER TABLE "AgencyCustomer" ADD CONSTRAINT "AgencyCustomer_poolId_fkey"
      FOREIGN KEY ("poolId") REFERENCES "AgencySeatPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyStaff_agencyId_fkey') THEN
    ALTER TABLE "AgencyStaff" ADD CONSTRAINT "AgencyStaff_agencyId_fkey"
      FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyActivity_agencyId_fkey') THEN
    ALTER TABLE "AgencyActivity" ADD CONSTRAINT "AgencyActivity_agencyId_fkey"
      FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$migration$;
