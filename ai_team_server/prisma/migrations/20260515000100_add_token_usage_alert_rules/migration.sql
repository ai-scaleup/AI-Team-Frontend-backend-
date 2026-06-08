-- CreateEnum
CREATE TYPE "TokenAlertLevel" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TokenAlertScope" AS ENUM ('CONVERSATION', 'MONTHLY');

-- CreateTable
CREATE TABLE "TokenUsageAlertRule" (
    "id" TEXT NOT NULL,
    "scope" "TokenAlertScope" NOT NULL DEFAULT 'CONVERSATION',
    "thresholdPercent" INTEGER NOT NULL,
    "level" "TokenAlertLevel" NOT NULL,
    "message" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TokenUsageAlertRule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TokenUsageAlertRule_thresholdPercent_check" CHECK ("thresholdPercent" BETWEEN 1 AND 100)
);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_token_alert_rule_scope_threshold" ON "TokenUsageAlertRule"("scope", "thresholdPercent");

-- CreateIndex
CREATE INDEX "TokenUsageAlertRule_scope_isActive_idx" ON "TokenUsageAlertRule"("scope", "isActive");

-- CreateIndex
CREATE INDEX "TokenUsageAlertRule_sortOrder_idx" ON "TokenUsageAlertRule"("sortOrder");

-- Seed default conversation alert rules
INSERT INTO "TokenUsageAlertRule" (
    "id",
    "scope",
    "thresholdPercent",
    "level",
    "message",
    "isActive",
    "sortOrder",
    "createdAt",
    "updatedAt"
) VALUES
    (
        'token-alert-conversation-50',
        'CONVERSATION',
        50,
        'INFO',
        'You''ve used 50% of your conversation tokens. Consider wrapping up soon.',
        true,
        1,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'token-alert-conversation-75',
        'CONVERSATION',
        75,
        'WARNING',
        '75% of conversation tokens used. You''re approaching the limit.',
        true,
        2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'token-alert-conversation-90',
        'CONVERSATION',
        90,
        'CRITICAL',
        '90% reached! Your conversation will end soon. Save important info now.',
        true,
        3,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
