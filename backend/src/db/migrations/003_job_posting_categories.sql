ALTER TABLE job_postings
ADD COLUMN IF NOT EXISTS industry_category VARCHAR(80);

UPDATE job_postings
SET industry_category = 'general_business'
WHERE industry_category IS NULL OR btrim(industry_category) = '';

ALTER TABLE job_postings
ALTER COLUMN industry_category SET DEFAULT 'general_business';

ALTER TABLE job_postings
ALTER COLUMN industry_category SET NOT NULL;
