DO
$$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ethics_app') THEN
    CREATE ROLE ethics_app LOGIN PASSWORD 'ethics_app_password';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ethics_contact_disclosure') THEN
    CREATE ROLE ethics_contact_disclosure LOGIN PASSWORD 'ethics_contact_password';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE ethics_hiring_tracker TO ethics_app;
GRANT CONNECT ON DATABASE ethics_hiring_tracker TO ethics_contact_disclosure;

