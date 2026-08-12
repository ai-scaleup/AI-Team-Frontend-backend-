DO $migration$
BEGIN
  EXECUTE 'ALTER TABLE ' || quote_ident('AgentGroup') ||
    ' DROP COLUMN IF EXISTS ' || quote_ident('singleconversationtokenlimit');
END
$migration$;
