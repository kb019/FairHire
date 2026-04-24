# Implementation Plan: Ethics Hiring Tracker

## Overview

Implement the Ethics Hiring Tracker as a React SPA (frontend) backed by a Node.js/Express REST API (backend) with a PostgreSQL database using a split public/identity_schema design. Tasks are ordered to build foundational infrastructure first, then core services, then UI layers, finishing with integration wiring.

## Tasks

- [ ] 1. Project scaffolding and database setup
  - Initialize a monorepo with `backend/` and `frontend/` directories
  - Set up `backend/` as a Node.js/TypeScript project with Express, `pg`, `bcrypt`, `jsonwebtoken`, `multer`, `pdf-parse`, `mammoth`, and `compromise` (NER) dependencies
  - Set up `frontend/` as a React/TypeScript project (Vite) with `react-router-dom`, `axios`, and a charting library (e.g., `recharts`)
  - Create `backend/src/db/migrations/001_initial_schema.sql` with all table definitions from the design: `hr_users`, `applicants`, `job_postings`, `ethics_reports`, `resumes`, `contact_disclosure_log`, `score_history`
  - Create `backend/src/db/migrations/002_identity_schema.sql` to create `identity_schema`, `identity_schema.applicant_identity`, and apply `REVOKE ALL` / role-based grants so only the contact-disclosure DB role can `SELECT` from `identity_schema.applicant_identity`
  - Create a `backend/src/db/client.ts` module that exports a configured `pg.Pool` and exposes separate pool instances for the default role and the contact-disclosure role
  - Add a `docker-compose.yml` for local PostgreSQL with the two roles pre-configured
  - _Requirements: 13.1, 13.5_

- [ ] 2. Authentication service — backend
  - [ ] 2.1 Implement HR user registration endpoint `POST /api/auth/register/hr`
    - Validate email format and password policy (min 8 chars, uppercase, lowercase, digit) in `backend/src/validators/auth.ts`
    - Hash password with bcrypt cost factor 12
    - Insert into `hr_users`; return 201 with user ID
    - _Requirements: 1.1, 1.2_

  - [ ] 2.2 Implement applicant registration endpoint `POST /api/auth/register/applicant`
    - Apply same validation rules as HR registration
    - Generate a cryptographically random `anonymous_id` in range 1000–9999 with "Candidate #" prefix
    - Store `email_hash` (SHA-256 of email) in `applicants` (public schema); store real email + phone in `identity_schema.applicant_identity` via the contact-disclosure role
    - _Requirements: 2.1, 2.2, 7.6_

  - [ ] 2.3 Implement shared login endpoint `POST /api/auth/login`
    - Accept email + password; detect user type by checking both tables
    - Issue JWT (8-hour expiry) containing `userId`, `userType` (`hr` | `applicant`)
    - Return generic error message on failure without revealing which field is wrong
    - _Requirements: 1.3, 1.4, 2.3, 2.4_

  - [ ] 2.4 Implement JWT auth middleware `backend/src/middleware/auth.ts`
    - Validate `Authorization: Bearer <token>` header on all protected routes
    - Attach decoded payload to `req.user`
    - Return 401 on missing/expired/invalid token
    - _Requirements: 1.3, 1.5, 2.3, 2.5_

  - [ ]* 2.5 Write unit tests for auth validators and JWT middleware
    - Test password policy edge cases (exactly 8 chars, missing uppercase, etc.)
    - Test JWT expiry and tampered-token rejection
    - _Requirements: 1.2, 1.4, 2.2, 2.4_

- [ ] 3. Job posting CRUD — backend
  - [ ] 3.1 Implement job posting endpoints in `backend/src/routes/jobPostings.ts`
    - `GET /api/job-postings` — list postings owned by authenticated HR user
    - `POST /api/job-postings` — create posting; associate with `hr_user_id`
    - `GET /api/job-postings/:id` — return posting + latest ethics report (ownership check)
    - `PUT /api/job-postings/:id` — update posting (ownership check); trigger re-analysis
    - `DELETE /api/job-postings/:id` — archive/soft-delete (ownership check)
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 13.3_

  - [ ]* 3.2 Write property test for HR data isolation (Property 6)
    - **Property 6: HR Data Isolation**
    - Generate two HR users and a job posting owned by user A; assert that all CRUD endpoints return 403/404 when called with user B's token
    - **Validates: Requirements 13.3**

  - [ ] 3.3 Implement score history recording
    - After every analysis run, insert a row into `score_history`
    - Add `GET /api/job-postings/:id/history` endpoint returning score over time
    - _Requirements: 10.4_

  - [ ]* 3.4 Write unit tests for job posting ownership enforcement
    - Test that missing/wrong ownership returns correct HTTP status codes
    - _Requirements: 3.3, 13.3_

- [ ] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Analyzer service — job posting bias detection
  - [ ] 5.1 Create `backend/src/analyzer/jobPostingAnalyzer.ts`
    - Implement detection rules for gendered language (wordlist: "rockstar", "ninja", "manpower", "aggressive", "dominant", etc.)
    - Implement detection rules for age-related language ("recent graduate", "digital native", "young", "energetic team")
    - Implement detection rules for exclusionary requirements (years-of-experience exceeding technology age)
    - Implement detection for missing EEO statement
    - Return array of `Issue` objects with `text_offset_start`, `text_offset_end`, `flagged_text`, `severity`, `explanation`, `suggestion`
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [ ] 5.2 Implement compliance score calculation in `backend/src/analyzer/scoreCalculator.ts`
    - Formula: `Math.max(0, 100 - (critical * 15) - (warning * 5) - (suggestion * 1))`
    - _Requirements: 4.6, 10.1_

  - [ ]* 5.3 Write property test for compliance score bounds (Property 4)
    - **Property 4: Compliance Score Bounds**
    - Generate arbitrary non-negative integer triples (critical, warning, suggestion); assert score is always in [0, 100]
    - **Validates: Requirements 4.6, 10.1**

  - [ ] 5.4 Implement stateless analysis endpoint `POST /api/analyze/job-posting`
    - Accept `{ text: string }`; run `jobPostingAnalyzer`; return issues + score
    - No database writes; used for real-time feedback
    - _Requirements: 4.1, 4.9_

  - [ ] 5.5 Wire analysis into job posting save/update flow
    - On `POST /api/job-postings` and `PUT /api/job-postings/:id`, call analyzer and persist result to `ethics_reports` and `score_history`
    - _Requirements: 3.4, 10.4_

  - [ ]* 5.6 Write unit tests for bias detection rules
    - Test each issue type with known-flagged and known-clean phrases
    - Test EEO statement detection (present vs. absent)
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [ ] 6. Issue acknowledgement and educational content
  - [ ] 6.1 Add `acknowledged` and `acknowledgement_note` fields to Issue objects stored in `ethics_reports.issues` JSONB
    - Implement `PUT /api/job-postings/:id/report/issues/:issueId/acknowledge` endpoint
    - Require non-empty `justification` body field; set `acknowledged: true`, store note
    - Recalculate score excluding acknowledged issues and update `job_postings.compliance_score`
    - _Requirements: 11.4_

  - [ ] 6.2 Add `explanation`, `suggestion`, and `educational_link` fields to each Issue in the analyzer output
    - Map each issue type to a static educational resource URL (EEOC guidelines, etc.)
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 6.3 Write unit tests for acknowledgement flow
    - Test that acknowledged issues are excluded from score recalculation
    - Test that missing justification returns 400
    - _Requirements: 11.4_

- [ ] 7. Resume parsing pipeline — backend
  - [ ] 7.1 Create `backend/src/analyzer/resumeParser.ts`
    - Accept a `Buffer` and MIME type; use `pdf-parse` for PDF and `mammoth` for DOCX to extract plain text
    - Segment extracted text into sections: `contact`, `summary`, `experience`, `education`, `skills`, `certifications`
    - Use heading-keyword matching and NLP heuristics for section detection; flag undetected sections rather than failing
    - Return a typed `ParsedResume` object
    - _Requirements: 5.2, 6.1, 6.2_

  - [ ] 7.2 Create `backend/src/analyzer/resumePrinter.ts`
    - Serialize a `ParsedResume` back to a canonical plain-text string
    - _Requirements: 6.3_

  - [ ]* 7.3 Write property test for resume round-trip parsing (Property 1)
    - **Property 1: Resume Round-Trip Parsing**
    - Generate synthetic `ParsedResume` objects; print then re-parse; assert structural equivalence
    - **Validates: Requirements 6.4**

  - [ ]* 7.4 Write unit tests for resume parser
    - Test PDF and DOCX extraction with fixture files
    - Test section detection for standard and non-standard resume layouts
    - Test graceful handling of undetectable sections
    - _Requirements: 6.1, 6.2_

- [ ] 8. Redactor — identity signal removal
  - [ ] 8.1 Create `backend/src/analyzer/redactor.ts`
    - Accept a `ParsedResume` and `applicantId`
    - Use `compromise` (NER) to detect person names and location entities in free-text fields
    - Apply regex patterns to detect and remove: dates of birth, ages, gender pronouns/indicators, marital status terms, nationality/citizenship phrases, religion references, home addresses
    - Replace detected name occurrences with the applicant's `anonymous_id`
    - Remove photo references (base64 data URIs, image file references)
    - Extract email and phone from the `contact` section; write them to `identity_schema.applicant_identity` via the contact-disclosure DB role
    - Return a `RedactedResume` containing only: `summary`, `skills`, `experience` (company names preserved, addresses stripped), `education` (graduation year stripped if it implies age), `certifications`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 8.2 Write property test for redaction completeness (Property 2)
    - **Property 2: Redaction Completeness**
    - Generate synthetic resumes with known PII fields; run redactor; assert zero occurrences of real name and all redacted field types in output (re-run NER + regex against output)
    - **Validates: Requirements 7.2, 7.3, 7.7, 13.5**

  - [ ]* 8.3 Write unit tests for redactor
    - Test name replacement with Anonymous_ID
    - Test removal of each identity field type individually
    - Test that skills, experience, education, and certifications are preserved
    - _Requirements: 7.2, 7.3, 7.4_

- [ ] 9. Resume submission endpoint — backend
  - [ ] 9.1 Implement `POST /api/resumes` in `backend/src/routes/resumes.ts`
    - Accept `multipart/form-data` with `file` and `jobPostingId` fields (authenticated applicant)
    - Validate file format (PDF/DOCX only) and size (≤ 5 MB); return descriptive errors on failure
    - Compute SHA-256 hash of file buffer for deduplication check
    - Run `resumeParser` → `redactor` pipeline; store `RedactedResume` in `resumes` table (public schema)
    - Do not persist the raw file after extraction
    - Return confirmation message to applicant; do not reveal redaction details
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.1, 7.5_

  - [ ]* 9.2 Write property test for Anonymous ID stability (Property 3)
    - **Property 3: Anonymous ID Stability**
    - Submit multiple resumes from the same applicant to different job postings; assert `anonymous_id` in all `resumes` rows matches the applicant's `applicants.anonymous_id`
    - **Validates: Requirements 7.6, 7.7**

  - [ ]* 9.3 Write integration tests for resume submission endpoint
    - Test PDF and DOCX uploads end-to-end through the full pipeline
    - Test file format rejection and size limit rejection
    - Test that raw file is not persisted after processing
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 5.6_

- [ ] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Candidate review and contact disclosure — backend
  - [ ] 11.1 Implement candidate review endpoints in `backend/src/routes/candidates.ts`
    - `GET /api/job-postings/:id/candidates` — return list of `{ anonymous_id, status, contact_revealed }` for the job posting (HR only, ownership check)
    - `GET /api/job-postings/:id/candidates/:anonymousId` — return full `redacted_content` for one candidate (no identity fields)
    - `PUT /api/job-postings/:id/candidates/:anonymousId/status` — set status to `shortlisted` or `rejected`
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 9.1_

  - [ ] 11.2 Implement contact disclosure endpoint `POST /api/job-postings/:id/candidates/:anonymousId/request-contact`
    - Use the contact-disclosure DB role to query `identity_schema.applicant_identity`
    - Write a row to `contact_disclosure_log` (append-only)
    - Return only `{ email, phone }` — no name or other identity fields
    - _Requirements: 9.2, 9.3, 9.4, 9.5_

  - [ ]* 11.3 Write property test for contact disclosure isolation (Property 5)
    - **Property 5: Contact Disclosure Isolation**
    - Call the contact disclosure endpoint for arbitrary applicants; assert response object has exactly two keys (`email`, `phone`) and contains no name, anonymous_id mapping, age, gender, nationality, or other identity fields
    - **Validates: Requirements 9.2, 9.3, 13.5**

  - [ ]* 11.4 Write unit tests for candidate review authorization
    - Test that HR user B cannot access HR user A's candidate list
    - Test that candidate detail returns only merit fields (no PII keys present in response)
    - _Requirements: 8.3, 13.3_

- [ ] 12. Analytics endpoints — backend
  - [ ] 12.1 Implement analytics endpoints in `backend/src/routes/analytics.ts`
    - `GET /api/analytics/overview` — average score, total issues by severity, across all HR user's postings
    - `GET /api/analytics/trends` — average score per week/month from `score_history`
    - `GET /api/analytics/top-issues` — top 5 most frequent issue types by count across all postings
    - All queries run against public schema only
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ]* 12.2 Write unit tests for analytics aggregation
    - Test empty-state responses (no job postings)
    - Test correct ranking of top issue types
    - _Requirements: 12.1, 12.3, 12.4_

- [ ] 13. Ethics report PDF export — backend
  - Implement `GET /api/job-postings/:id/report` using a PDF generation library (e.g., `pdfkit`)
  - Include: job title, compliance score, color-coded score indicator, full issue list with severity/explanation/suggestion, acknowledgement notes
  - _Requirements: 10.3_

- [ ] 14. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Frontend — authentication screens
  - [ ] 15.1 Create `frontend/src/pages/RegisterHR.tsx` and `RegisterApplicant.tsx`
    - Form fields: email, password, confirm password
    - Client-side validation matching backend rules (8 chars, uppercase, lowercase, digit)
    - Display API error messages without revealing which field caused the failure
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

  - [ ] 15.2 Create `frontend/src/pages/Login.tsx`
    - Shared login form for both user types
    - Store JWT in `httpOnly`-equivalent storage (memory + refresh pattern or `sessionStorage`)
    - Redirect to appropriate dashboard on success; redirect to login on token expiry
    - _Requirements: 1.3, 1.5, 2.3, 2.5_

  - [ ]* 15.3 Write unit tests for auth form validation
    - Test password policy enforcement in the UI
    - Test error message display on failed login
    - _Requirements: 1.2, 1.4, 2.2, 2.4_

- [ ] 16. Frontend — HR job posting editor with real-time analysis
  - [ ] 16.1 Create `frontend/src/pages/JobPostingEditor.tsx`
    - Form fields: title, department, location, employment type, responsibilities, required qualifications, preferred qualifications, compensation range
    - Rich text area for the main content field
    - Debounce input by 1 second; call `POST /api/analyze/job-posting` on pause
    - _Requirements: 3.1, 4.1_

  - [ ] 16.2 Implement inline issue highlighting in the editor
    - Use text offset positions from the API response to render color-coded underline/highlight markers (red = critical, yellow = warning, blue = suggestion)
    - Show tooltip on hover with `explanation` and `suggestion` text
    - Include link to `educational_link` in tooltip
    - _Requirements: 4.7, 11.1, 11.2, 11.3_

  - [ ] 16.3 Implement compliance score indicator
    - Display score as a number with color-coded badge: green (80–100), yellow (50–79), red (0–49)
    - Show compliance badge when score ≥ 80
    - Update in real time as issues are resolved or introduced
    - _Requirements: 4.8, 10.2, 10.5_

  - [ ] 16.4 Implement issue acknowledgement UI
    - Clicking a highlighted issue opens a panel showing explanation, suggestion, and educational link
    - "Mark as intentional" button opens a justification text field; submits to the acknowledge endpoint
    - _Requirements: 11.4_

  - [ ] 16.5 Implement fallback notification for unavailable analysis service
    - If the real-time analysis call fails, display a non-blocking banner: "Live analysis unavailable — analysis will run on save"
    - _Requirements: 4.9_

  - [ ]* 16.6 Write unit tests for debounce and real-time analysis integration
    - Test that API is not called more than once per debounce window
    - Test that highlights render at correct text positions
    - _Requirements: 4.1, 4.7_

- [ ] 17. Frontend — HR job postings list and detail
  - Create `frontend/src/pages/JobPostingsList.tsx` showing title, creation date, compliance score for each posting
  - Create `frontend/src/pages/JobPostingDetail.tsx` showing full posting, ethics report issues list, score history chart, and download report button
  - Wire edit/archive/delete actions to the corresponding API endpoints
  - _Requirements: 3.3, 3.5, 10.2, 10.4_

- [ ] 18. Frontend — anonymous candidate review
  - [ ] 18.1 Create `frontend/src/pages/CandidateList.tsx`
    - Display candidates by Anonymous_ID only; no real names or identity fields
    - Show merit fields: skills, experience summary, education level
    - Implement sort/filter controls for skills, years of experience, education level
    - Show "Contact Revealed" badge on candidates where disclosure has occurred
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.6_

  - [ ] 18.2 Create `frontend/src/pages/CandidateDetail.tsx`
    - Display full `redacted_content` (summary, skills, experience, education, certifications)
    - "Shortlist" / "Reject" action buttons
    - "Request Contact Info" button; on success display `{ email, phone }` alongside Anonymous_ID
    - _Requirements: 8.2, 8.5, 9.1, 9.2, 9.5_

  - [ ]* 18.3 Write unit tests for candidate list rendering
    - Assert no identity fields (name, age, gender, etc.) are rendered in the component output
    - Test sort and filter controls
    - _Requirements: 8.1, 8.3_

- [ ] 19. Frontend — applicant portal
  - Create `frontend/src/pages/ApplicantDashboard.tsx` showing available job postings and submission history
  - Create `frontend/src/pages/ResumeUpload.tsx` with file picker (PDF/DOCX), size validation, and job posting selector
  - Display confirmation message on successful submission; do not show redaction details
  - _Requirements: 5.1, 5.3, 5.4, 5.5, 5.6_

- [ ] 20. Frontend — HR analytics dashboard
  - Create `frontend/src/pages/AnalyticsDashboard.tsx`
  - Display: average compliance score card, issues-by-severity breakdown, trend line chart (using `recharts`), top-5 issue types ranked list
  - Show empty state with guidance when no job postings exist
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 21. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 22. Wiring, routing, and authorization guards
  - [ ] 22.1 Set up React Router routes in `frontend/src/App.tsx`
    - Public routes: `/login`, `/register/hr`, `/register/applicant`
    - HR-only routes (guarded): `/dashboard`, `/job-postings`, `/job-postings/:id`, `/job-postings/:id/candidates`, `/analytics`
    - Applicant-only routes (guarded): `/apply`, `/my-applications`
    - Redirect unauthenticated users to `/login`; redirect expired sessions to `/login`
    - _Requirements: 1.5, 2.5_

  - [ ] 22.2 Add Express route registration and global error handler in `backend/src/app.ts`
    - Mount all route modules under `/api`
    - Add a global error-handling middleware that returns consistent JSON error shapes
    - Add rate-limiting middleware on auth endpoints
    - _Requirements: 13.2_

  - [ ]* 22.3 Write integration tests for full HR workflow
    - Register HR user → create job posting → analyze → save → view candidates → request contact
    - Assert each step returns correct status codes and response shapes
    - _Requirements: 3.1, 3.2, 4.1, 8.1, 9.2_

  - [ ]* 22.4 Write integration tests for full applicant workflow
    - Register applicant → upload resume → assert redacted content stored, raw file not persisted
    - _Requirements: 5.1, 7.1, 7.2, 7.5_

- [ ] 23. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests (Properties 1–6) validate universal correctness guarantees defined in the design document
- The split-schema identity isolation is enforced at the database role level — the application-level separation in the Contact Disclosure Service is a second layer, not the primary control
- Raw resume files must never be persisted after text extraction; only the structured `RedactedResume` is stored
