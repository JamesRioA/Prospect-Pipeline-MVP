CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  domain varchar(255),
  logo_url text,
  enrichment_source varchar(30) DEFAULT 'manual',
  enriched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_companies_domain ON companies (domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_companies_name ON companies (name);
