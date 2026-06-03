-- Lookup table: contact sources
CREATE TABLE contact_sources (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(50) NOT NULL UNIQUE
);

INSERT INTO contact_sources (name) VALUES
  ('csv_import'), ('manual'), ('telegram_bot'), ('api');

-- Lookup table: email statuses
CREATE TABLE email_statuses (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(30) NOT NULL UNIQUE
);

INSERT INTO email_statuses (name) VALUES
  ('pending'), ('draft_generated'), ('sent'), ('replied'), ('bounced');
