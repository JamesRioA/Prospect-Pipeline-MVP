CREATE TABLE email_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  body text NOT NULL,
  generation_source varchar(20) NOT NULL DEFAULT 'gemini',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_drafts_contact ON email_drafts (contact_id);
CREATE INDEX idx_drafts_active ON email_drafts (contact_id) WHERE is_active = true;
