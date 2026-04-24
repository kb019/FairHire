# Design Document

## Overview

The Ethics Hiring Tracker is a web application built around three core workflows: real-time ethical analysis of job postings for HR users, silent identity redaction of applicant resumes, and anonymous candidate review with controlled contact disclosure. The design prioritizes a clean separation between identity data and merit data at the data layer, so that the anonymization guarantee is structural rather than just a UI concern.

## Architecture

The system uses a standard three-tier web architecture:

- **Frontend**: Single-page application (React) served via CDN
- **Backend API**: RESTful API (Node.js / Express) handling business logic
- **Database**: PostgreSQL for relational data; a separate access-controlled schema for identity mapping

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│   ┌──────────────┐          ┌──────────────────────┐   │
│   │  HR Portal   │          │   Applicant Portal   │   │
│   └──────┬───────┘          └──────────┬───────────┘   │
└──────────┼──────────────────────────────┼───────────────┘
           │ HTTPS / TLS 1.2+             │
┌──────────▼──────────────────────────────▼───────────────┐
│                     API Gateway                         │
│              (Auth middleware, rate limiting)            │
└──────────┬──────────────────────────────┬───────────────┘
           │                              │
┌──────────▼──────────┐      ┌────────────▼──────────────┐
│   Core API Service  │      │    Analyzer Service        │
│  - Auth             │      │  - Job posting analysis    │
│  - Job postings     │      │  - Resume parsing          │
│  - Candidate review │      │  - Identity redaction      │
│  - Contact reveal   │      └────────────┬──────────────┘
└──────────┬──────────┘                   │
           │                              │
┌──────────▼──────────────────────────────▼───────────────┐
│                      PostgreSQL                         │
│  ┌─────────────────────┐   ┌──────────────────────────┐ │
│  │   Public Schema     │   │   Identity Schema        │ │
│  │  (merit data,       │   │  (name↔ID mapping,       │ │
│  │   anonymous IDs,    │   │   contact info,          │ │
│  │   job postings)     │   │   access-controlled)     │ │
│  └─────────────────────┘   └──────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Key Architectural Decision: Split Schema for Identity Isolation

The mapping between an `Anonymous_ID` and an applicant's real identity (name, contact info) is stored in a separate PostgreSQL schema (`identity_schema`) with its own access controls. The Core API service only queries this schema in two specific cases:

1. When an HR user explicitly triggers "Request Contact Info"
2. When an applicant manages their own account

All other HR-facing queries run exclusively against the public schema, making it structurally impossible for identity data to leak into the candidate review workflow through a query bug.

---

## Components

### 1. Auth Service

Handles registration, login, session token issuance, and token validation for both HR users and applicants. Uses JWT tokens with an 8-hour expiry. Passwords are hashed with bcrypt (cost factor 12).

### 2. Job Posting Service

Manages CRUD operations for job postings. On create or update, triggers the Analyzer Service asynchronously and stores the resulting Ethics Report. Exposes endpoints for the HR portal to retrieve postings with their current compliance scores.

### 3. Analyzer Service

Two distinct responsibilities:

**Job Posting Analysis**
- Receives job posting text
- Runs NLP-based bias detection (gendered terms, age language, exclusionary requirements, missing EEO statement)
- Returns a structured list of Issues with location offsets, severity, and suggested corrections
- Calculates Compliance Score: `100 - (critical × 15) - (warning × 5) - (suggestion × 1)`, floor 0

**Resume Processing Pipeline**
- Parses PDF/DOCX to plain text (using `pdf-parse` / `mammoth`)
- Segments text into structured sections (contact, summary, experience, education, skills, certifications)
- Passes structured resume to the Redactor

### 4. Redactor

A sub-component of the Analyzer Service. Receives a structured parsed resume and:

1. Extracts contact fields (email, phone) and stores them in `identity_schema`
2. Removes or replaces identity signals: full name → Anonymous_ID, photo → removed, age/DOB → removed, gender indicators → removed, marital status → removed, nationality → removed, religion → removed, home address → removed
3. Returns a `Redacted_Resume` containing only merit-based content

The Redactor uses a combination of named-entity recognition (NER) for names and locations, regex patterns for dates/ages, and section-based rules for structured fields.

### 5. Candidate Review Service

Serves the HR candidate list. All queries return only `Redacted_Resume` content plus the `Anonymous_ID`. Has no join path to `identity_schema` in normal operation.

### 6. Contact Disclosure Service

Handles "Request Contact Info" actions. This is the only service with read access to `identity_schema` contact data. On request:

1. Validates the HR user has an active session
2. Retrieves email and phone for the given `Anonymous_ID` from `identity_schema`
3. Logs the disclosure event (HR user ID, Anonymous_ID, Job Posting ID, timestamp) to an audit log
4. Returns only email and phone — no name or other identity fields

### 7. Analytics Service

Aggregates compliance data across all job postings for an HR user. Computes average scores, issue frequency rankings, and trend data. Read-only against the public schema.

---

## Data Models

### `hr_users`
```sql
id            UUID PRIMARY KEY
email         VARCHAR(255) UNIQUE NOT NULL
password_hash VARCHAR(255) NOT NULL
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `applicants` (public schema — no PII)
```sql
id            UUID PRIMARY KEY
anonymous_id  VARCHAR(20) UNIQUE NOT NULL  -- e.g. "Candidate #1042"
email_hash    VARCHAR(255) NOT NULL        -- for login lookup only
password_hash VARCHAR(255) NOT NULL
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `identity_schema.applicant_identity`
```sql
applicant_id  UUID PRIMARY KEY REFERENCES public.applicants(id)
email         VARCHAR(255) NOT NULL
phone         VARCHAR(50)
created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```
Access: readable only by the Contact Disclosure Service and the applicant's own account management endpoints.

### `job_postings`
```sql
id              UUID PRIMARY KEY
hr_user_id      UUID NOT NULL REFERENCES hr_users(id)
title           VARCHAR(255) NOT NULL
department      VARCHAR(255)
location        VARCHAR(255)
employment_type VARCHAR(50)
content         TEXT NOT NULL           -- full job posting text
status          VARCHAR(20) NOT NULL    -- draft | published | archived
compliance_score INTEGER
created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `ethics_reports`
```sql
id             UUID PRIMARY KEY
job_posting_id UUID NOT NULL REFERENCES job_postings(id)
issues         JSONB NOT NULL          -- array of Issue objects
score          INTEGER NOT NULL
created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
```

Issue object shape:
```json
{
  "id": "uuid",
  "type": "gendered_language | age_language | exclusionary_requirement | missing_eeo | ...",
  "severity": "critical | warning | suggestion",
  "text_offset_start": 142,
  "text_offset_end": 149,
  "flagged_text": "rockstar",
  "explanation": "...",
  "suggestion": "...",
  "acknowledged": false,
  "acknowledgement_note": null
}
```

### `resumes` (public schema — merit data only)
```sql
id              UUID PRIMARY KEY
applicant_id    UUID NOT NULL REFERENCES applicants(id)
job_posting_id  UUID NOT NULL REFERENCES job_postings(id)
anonymous_id    VARCHAR(20) NOT NULL    -- denormalized for query convenience
redacted_content JSONB NOT NULL         -- structured merit-only content
raw_file_hash   VARCHAR(64) NOT NULL    -- SHA-256 of original file, for dedup
submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
status          VARCHAR(20) NOT NULL    -- pending | processed | failed
```

Redacted content shape:
```json
{
  "summary": "...",
  "skills": ["Python", "SQL", "..."],
  "experience": [
    {
      "title": "Software Engineer",
      "company": "Company A",
      "duration_months": 24,
      "description": "..."
    }
  ],
  "education": [
    {
      "degree": "B.Sc. Computer Science",
      "institution": "University X"
    }
  ],
  "certifications": ["AWS Certified Solutions Architect"]
}
```

### `contact_disclosure_log`
```sql
id             UUID PRIMARY KEY
hr_user_id     UUID NOT NULL REFERENCES hr_users(id)
anonymous_id   VARCHAR(20) NOT NULL
job_posting_id UUID NOT NULL REFERENCES job_postings(id)
disclosed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
```

### `score_history`
```sql
id             UUID PRIMARY KEY
job_posting_id UUID NOT NULL REFERENCES job_postings(id)
score          INTEGER NOT NULL
recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

---

## API Design

All endpoints require a valid JWT in the `Authorization: Bearer <token>` header unless marked public.

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register/hr` | Register HR user |
| POST | `/api/auth/register/applicant` | Register applicant |
| POST | `/api/auth/login` | Login (both user types) |

### Job Postings (HR)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/job-postings` | List HR user's job postings |
| POST | `/api/job-postings` | Create job posting |
| GET | `/api/job-postings/:id` | Get job posting with current ethics report |
| PUT | `/api/job-postings/:id` | Update job posting (triggers re-analysis) |
| DELETE | `/api/job-postings/:id` | Archive/delete job posting |
| GET | `/api/job-postings/:id/report` | Download ethics report as PDF |

### Real-Time Analysis (HR)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/analyze/job-posting` | Analyze job posting text snippet (used for real-time feedback; stateless, no persistence) |

### Resume Submission (Applicant)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/resumes` | Upload resume (multipart/form-data) for a specific job posting |

### Candidate Review (HR)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/job-postings/:id/candidates` | List anonymous candidates for a job posting |
| GET | `/api/job-postings/:id/candidates/:anonymousId` | Get redacted resume detail for a candidate |
| PUT | `/api/job-postings/:id/candidates/:anonymousId/status` | Set candidate status (shortlisted / rejected) |
| POST | `/api/job-postings/:id/candidates/:anonymousId/request-contact` | Request contact info for a candidate |

### Analytics (HR)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/overview` | Aggregate compliance stats across all job postings |
| GET | `/api/analytics/trends` | Score trend data over time |
| GET | `/api/analytics/top-issues` | Top 5 most frequent issue types |

---

## Real-Time Analysis Flow

The inline job posting editor uses a debounced approach to avoid excessive API calls:

1. HR user types in the editor
2. Frontend debounces input — waits 1 second after the last keystroke
3. Frontend sends the current full text to `POST /api/analyze/job-posting`
4. API returns issues with text offsets within ~2 seconds
5. Frontend renders inline highlights using the offset positions
6. Compliance score indicator updates in the UI

This endpoint is stateless — it does not persist the analysis. Persistence happens only when the HR user explicitly saves the job posting.

---

## Resume Processing Flow

```
Applicant uploads PDF/DOCX
        │
        ▼
File validation (format, size)
        │
        ▼
Text extraction (pdf-parse / mammoth)
        │
        ▼
Section segmentation (NLP)
        │
        ▼
Redactor
  ├── Extract email + phone → identity_schema.applicant_identity
  ├── Remove: name, photo, age/DOB, gender, marital status,
  │          nationality, religion, home address
  ├── Replace name with Anonymous_ID
  └── Preserve: skills, experience, education, certifications
        │
        ▼
Store Redacted_Resume in resumes table (public schema)
        │
        ▼
Return confirmation to applicant (no redaction details shown)
```

---

## Contact Disclosure Flow

```
HR user clicks "Request Contact Info" for Candidate #1042
        │
        ▼
POST /api/job-postings/:id/candidates/Candidate%231042/request-contact
        │
        ▼
Contact Disclosure Service
  ├── Validate HR user session
  ├── Look up applicant_id from anonymous_id (public schema)
  ├── Query identity_schema.applicant_identity for email + phone
  ├── Write to contact_disclosure_log
  └── Return { email, phone } only
        │
        ▼
HR Dashboard shows email + phone alongside "Candidate #1042"
Identity (name, etc.) remains hidden permanently
```

---

## Security Considerations

**Identity isolation**: The `identity_schema` is a separate PostgreSQL schema with `REVOKE ALL` on the application's default role. Only the Contact Disclosure Service's database role has `SELECT` on `identity_schema.applicant_identity`. This is enforced at the database level, not just the application level.

**Audit logging**: Every contact disclosure is logged immutably to `contact_disclosure_log`. This log is append-only from the application's perspective (no UPDATE or DELETE grants on that table for the app role).

**Encryption at rest**: All database volumes are encrypted using AES-256. Resume files are not stored after text extraction — only the extracted and redacted structured content is persisted.

**Transport security**: All API traffic requires HTTPS with TLS 1.2 or higher. HTTP requests are redirected to HTTPS at the load balancer.

**Authorization**: HR users can only access job postings and candidates associated with their own account. Applicants can only access their own submission history. All resource ownership is validated server-side before returning data.

**Anonymous ID generation**: Anonymous IDs are generated at account creation using a cryptographically random number in the range 1000–9999 with a prefix, stored in the `applicants` table. The ID is stable across all applications from that applicant.

---

## Correctness Properties

The following properties are derived from the acceptance criteria and should be verified through testing:

### Property 1: Resume Round-Trip Parsing
For all valid resume documents, parsing a resume into structured sections and then printing it back to text, then parsing again, must produce an equivalent structured object. This catches bugs in the parser/printer pipeline.

### Property 2: Redaction Completeness
For all submitted resumes, the Redacted_Resume must contain zero occurrences of the applicant's real name, and must not contain any of the redacted field types (age, DOB, gender indicators, marital status, nationality, religion, home address). This is verifiable by running the same NER and pattern-matching logic used by the Redactor against the output.

### Property 3: Anonymous ID Stability
For any applicant who submits multiple resumes to multiple job postings, the Anonymous_ID used in all Redacted_Resumes must be identical to the Anonymous_ID stored in the `applicants` table for that applicant.

### Property 4: Compliance Score Bounds
For all job postings, the Compliance_Score must be an integer in the range [0, 100]. The score formula `100 - (critical × 15) - (warning × 5) - (suggestion × 1)` with a floor of 0 must hold for all combinations of issue counts.

### Property 5: Contact Disclosure Isolation
After a "Request Contact Info" action, the response must contain exactly two fields (email and phone). It must not contain the applicant's real name, Anonymous_ID mapping details, age, gender, nationality, or any other identity field beyond contact details.

### Property 6: HR Data Isolation
An HR user must never be able to retrieve job postings, ethics reports, or candidate lists belonging to a different HR user, regardless of the job posting ID supplied in the request.
