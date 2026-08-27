-- Additive-only migration: bundles teams (AgentGroup) into membership templates.
-- This migration does not rename, alter, truncate, or drop any existing object.
--
-- Unlinking a team from a template is a soft toggle on "isActive", so no row is
-- ever removed from this table once written.

CREATE TABLE "MembershipTemplateGroup" (
    "id" TEXT NOT NULL,
    "membershipTemplateId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MembershipTemplateGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uniq_group_per_membership_template"
    ON "MembershipTemplateGroup"("membershipTemplateId", "groupId");

CREATE INDEX "MembershipTemplateGroup_membershipTemplateId_isActive_idx"
    ON "MembershipTemplateGroup"("membershipTemplateId", "isActive");

CREATE INDEX "MembershipTemplateGroup_groupId_idx"
    ON "MembershipTemplateGroup"("groupId");

ALTER TABLE "MembershipTemplateGroup"
    ADD CONSTRAINT "MembershipTemplateGroup_membershipTemplateId_fkey"
    FOREIGN KEY ("membershipTemplateId")
    REFERENCES "MembershipTemplate"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

ALTER TABLE "MembershipTemplateGroup"
    ADD CONSTRAINT "MembershipTemplateGroup_groupId_fkey"
    FOREIGN KEY ("groupId")
    REFERENCES "AgentGroup"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
