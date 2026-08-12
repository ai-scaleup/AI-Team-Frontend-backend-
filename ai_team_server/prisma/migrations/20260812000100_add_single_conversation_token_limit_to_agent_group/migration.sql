DO $migration$
BEGIN
  EXECUTE 'ALTER TABLE ' || quote_ident('AgentGroup') ||
    ' ADD COLUMN IF NOT EXISTS ' || quote_ident('singleConversationTokenLimit') ||
    ' INTEGER NOT NULL DEFAULT 0';
END
$migration$;
