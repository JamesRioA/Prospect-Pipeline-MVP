CREATE TABLE action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_log_id uuid NOT NULL REFERENCES voice_logs(id) ON DELETE CASCADE,
  description varchar(500) NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_items_voice_log ON action_items (voice_log_id);
CREATE INDEX idx_action_items_incomplete ON action_items (voice_log_id) WHERE is_completed = false;
