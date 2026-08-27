-- Additive-only migration for isolated Pearl white-label data.
-- This migration does not rename, alter, truncate, or drop any existing object.

CREATE TABLE "pearl_whitelabel_User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "oauthId" TEXT NOT NULL,
    "username" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pearl_whitelabel_User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pearl_whitelabel_UserData" (
    "id" TEXT NOT NULL,
    "campaignName" TEXT NOT NULL,
    "outboundId" TEXT NOT NULL,
    "bearerToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "pearl_whitelabel_UserData_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pearl_whitelabel_User_email_key"
    ON "pearl_whitelabel_User"("email");

CREATE UNIQUE INDEX "pearl_whitelabel_User_oauthId_key"
    ON "pearl_whitelabel_User"("oauthId");

CREATE INDEX "pearl_whitelabel_UserData_userId_idx"
    ON "pearl_whitelabel_UserData"("userId");

ALTER TABLE "pearl_whitelabel_UserData"
    ADD CONSTRAINT "pearl_whitelabel_UserData_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "pearl_whitelabel_User"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
