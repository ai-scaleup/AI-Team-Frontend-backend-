ALTER TABLE "UserPreference" ADD COLUMN "email" TEXT;

UPDATE "UserPreference" AS preference
SET "email" = "User"."email"
FROM "User"
WHERE preference."oauthId" = "User"."oauthId";

ALTER TABLE "UserPreference" ALTER COLUMN "email" SET NOT NULL;

CREATE INDEX "UserPreference_email_idx" ON "UserPreference"("email");
