-- Additive only: creates five NEW tables for agency white label (branding,
-- own addresses) and the agency customers' own password login (setup links,
-- logins, sessions). No existing table, column, type or row is dropped,
-- altered, updated or deleted. Every foreign key is ON DELETE RESTRICT.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyBranding" (
    "agencyId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "logoDataUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#0ea5e9',
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyBranding_pkey" PRIMARY KEY ("agencyId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyDomain" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyLoginInvite" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "replacedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyLoginInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyCustomerLogin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordSetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyCustomerLogin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyCustomerSession" (
    "id" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyCustomerSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AgencyDomain_hostname_idx" ON "AgencyDomain"("hostname");
CREATE INDEX IF NOT EXISTS "AgencyDomain_agencyId_idx" ON "AgencyDomain"("agencyId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyLoginInvite_codeHash_key" ON "AgencyLoginInvite"("codeHash");
CREATE INDEX IF NOT EXISTS "AgencyLoginInvite_customerId_idx" ON "AgencyLoginInvite"("customerId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyCustomerLogin_userId_key" ON "AgencyCustomerLogin"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyCustomerSession_tokenHash_key" ON "AgencyCustomerSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "AgencyCustomerSession_loginId_idx" ON "AgencyCustomerSession"("loginId");

-- AddForeignKey (all RESTRICT: deleting a parent row is refused, never cascaded)
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyBranding_agencyId_fkey') THEN
    ALTER TABLE "AgencyBranding" ADD CONSTRAINT "AgencyBranding_agencyId_fkey"
      FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyDomain_agencyId_fkey') THEN
    ALTER TABLE "AgencyDomain" ADD CONSTRAINT "AgencyDomain_agencyId_fkey"
      FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyLoginInvite_agencyId_fkey') THEN
    ALTER TABLE "AgencyLoginInvite" ADD CONSTRAINT "AgencyLoginInvite_agencyId_fkey"
      FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyLoginInvite_customerId_fkey') THEN
    ALTER TABLE "AgencyLoginInvite" ADD CONSTRAINT "AgencyLoginInvite_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "AgencyCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyCustomerLogin_userId_fkey') THEN
    ALTER TABLE "AgencyCustomerLogin" ADD CONSTRAINT "AgencyCustomerLogin_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyCustomerSession_loginId_fkey') THEN
    ALTER TABLE "AgencyCustomerSession" ADD CONSTRAINT "AgencyCustomerSession_loginId_fkey"
      FOREIGN KEY ("loginId") REFERENCES "AgencyCustomerLogin"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyCustomerSession_agencyId_fkey') THEN
    ALTER TABLE "AgencyCustomerSession" ADD CONSTRAINT "AgencyCustomerSession_agencyId_fkey"
      FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$migration$;
