-- Renames the Chiara Vanessa agent to Vanessa. Rename only: no table, column,
-- row or enum value is dropped, and every statement is safe to re-run.

-- Enum value. Rows already assigned CHIARA_VANESSA read back as VANESSA,
-- because Postgres stores the value by reference, not by label.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AgentName' AND e.enumlabel = 'CHIARA_VANESSA'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AgentName' AND e.enumlabel = 'VANESSA'
  ) THEN
    ALTER TYPE "AgentName" RENAME VALUE 'CHIARA_VANESSA' TO 'VANESSA';
  END IF;
END $$;

-- Tables. Their rows move with them.
ALTER TABLE IF EXISTS "chiara_vanessa_leads" RENAME TO "vanessa_leads";
ALTER TABLE IF EXISTS "chiara_vanessa_chat_logs" RENAME TO "vanessa_chat_logs";

-- Primary keys (renaming the index renames its constraint too) and indexes.
ALTER INDEX IF EXISTS "chiara_vanessa_leads_pkey" RENAME TO "vanessa_leads_pkey";
ALTER INDEX IF EXISTS "chiara_vanessa_leads_session_id_idx" RENAME TO "vanessa_leads_session_id_idx";
ALTER INDEX IF EXISTS "chiara_vanessa_leads_email_idx" RENAME TO "vanessa_leads_email_idx";
ALTER INDEX IF EXISTS "chiara_vanessa_leads_created_at_idx" RENAME TO "vanessa_leads_created_at_idx";

ALTER INDEX IF EXISTS "chiara_vanessa_chat_logs_pkey" RENAME TO "vanessa_chat_logs_pkey";
ALTER INDEX IF EXISTS "chiara_vanessa_chat_logs_session_id_idx" RENAME TO "vanessa_chat_logs_session_id_idx";
ALTER INDEX IF EXISTS "chiara_vanessa_chat_logs_sender_idx" RENAME TO "vanessa_chat_logs_sender_idx";

-- id sequences. The column defaults point at the sequence itself, not its
-- name, so they keep working after the rename.
ALTER SEQUENCE IF EXISTS "chiara_vanessa_leads_id_seq" RENAME TO "vanessa_leads_id_seq";
ALTER SEQUENCE IF EXISTS "chiara_vanessa_chat_logs_id_seq" RENAME TO "vanessa_chat_logs_id_seq";
