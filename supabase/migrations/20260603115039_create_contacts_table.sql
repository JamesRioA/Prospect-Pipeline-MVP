CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  email varchar(320) NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  role varchar(255),
  linkedin_url varchar(2048),
  source_id smallint NOT NULL REFERENCES contact_sources(id) DEFAULT 1,
  email_status_id smallint NOT NULL REFERENCES email_statuses(id) DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_contacts_email ON contacts (email);
CREATE INDEX idx_contacts_company ON contacts (company_id);
CREATE INDEX idx_contacts_source ON contacts (source_id);
CREATE INDEX idx_contacts_status ON contacts (email_status_id);
CREATE INDEX idx_contacts_created ON contacts (created_at DESC);
