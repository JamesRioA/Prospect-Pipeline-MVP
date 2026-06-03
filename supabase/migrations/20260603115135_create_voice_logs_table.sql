CREATE TABLE voice_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  telegram_message_id varchar(100),
  transcript text NOT NULL,
  summary text NOT NULL,
  sheet_row_id varchar(100),
  transcription_source varchar(20) NOT NULL DEFAULT 'groq',
  summary_source varchar(20) NOT NULL DEFAULT 'gemini',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_logs_contact ON voice_logs (contact_id);
CREATE INDEX idx_voice_logs_created ON voice_logs (created_at DESC);
