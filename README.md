# Ethics Hiring Tracker

Initial product scaffold for the Ethics Hiring Tracker spec in `.kiro/specs/ethics-hiring-tracker`.

## Workspace layout

- `backend/`: Express + TypeScript API
- `frontend/`: React + Vite SPA
- `docker/`: local PostgreSQL bootstrap scripts

## First implemented slice

- Monorepo workspace and TypeScript setup
- PostgreSQL schema migrations for public and `identity_schema`
- Express API with:
  - HR/applicant registration
  - shared login with JWTs
  - stateless job posting analysis endpoint
  - HR job posting CRUD with compliance score persistence
- resume upload, parsing, redaction, and applicant submission history
  - HR candidate review, contact disclosure, analytics, and PDF ethics report download
- React shell with auth pages, applicant dashboard, HR dashboard, candidate review, and job posting editor

## Quick start

1. Copy `.env.example` to `.env` at the repo root.
2. Start PostgreSQL:

```bash
docker compose up -d
```

3. The app expects Postgres on host port `5433`.
4. Run the SQL migrations in `backend/src/db/migrations/`.
4. Install dependencies:

```bash
npm install
```

5. Start the backend and frontend in separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

## Notes

- Job posting analysis now supports an OpenAI-backed path when `OPENAI_API_KEY` is set. Without it, the app falls back to the local heuristic detector.
- `OPENAI_ANALYSIS_MODEL` defaults to `gpt-5.4-mini` and can be overridden in `.env`.
- The current parser/redactor is still heuristic and intended as a working baseline, not a production-grade fairness model.
- Automated tests are still missing; the repo is currently verified by TypeScript checks and production builds.
