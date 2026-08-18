CREATE TABLE IF NOT EXISTS "freap_jennifer_chat_logs" (
  "id" SERIAL NOT NULL,
  "session_id" VARCHAR(255) NOT NULL,
  "sender" VARCHAR(50) NOT NULL,
  "message_text" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "freap_jennifer_chat_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "freap_jennifer_chat_logs_session_id_idx"
  ON "freap_jennifer_chat_logs"("session_id");

CREATE INDEX IF NOT EXISTS "freap_jennifer_chat_logs_sender_idx"
  ON "freap_jennifer_chat_logs"("sender");
