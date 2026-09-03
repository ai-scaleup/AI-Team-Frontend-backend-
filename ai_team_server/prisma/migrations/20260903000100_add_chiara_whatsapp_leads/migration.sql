CREATE TABLE IF NOT EXISTS "chiara_whatsapp_leads" (
  "id" SERIAL NOT NULL,
  "session_id" VARCHAR(255) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(50) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "chiara_whatsapp_leads_pkey" PRIMARY KEY ("id")
);

-- A session can hold many leads, so this index is deliberately not unique.
CREATE INDEX IF NOT EXISTS "chiara_whatsapp_leads_session_id_idx"
  ON "chiara_whatsapp_leads"("session_id");

CREATE INDEX IF NOT EXISTS "chiara_whatsapp_leads_email_idx"
  ON "chiara_whatsapp_leads"("email");

CREATE INDEX IF NOT EXISTS "chiara_whatsapp_leads_created_at_idx"
  ON "chiara_whatsapp_leads"("created_at");
