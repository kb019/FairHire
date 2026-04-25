CREATE SCHEMA IF NOT EXISTS identity_schema;

CREATE TABLE IF NOT EXISTS identity_schema.applicant_identity (
  applicant_id UUID PRIMARY KEY REFERENCES public.applicants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON SCHEMA identity_schema FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA identity_schema FROM PUBLIC;

GRANT USAGE ON SCHEMA identity_schema TO ethics_contact_disclosure;
GRANT SELECT, INSERT, UPDATE ON identity_schema.applicant_identity TO ethics_contact_disclosure;

