# Project Description

## One-Sentence Summary

Ethics Hiring Tracker is a bias-aware recruiting platform that combines live job-posting analysis, anonymized candidate review, and controlled contact disclosure in one end-to-end workflow.

## Product Thesis

Most hiring tools optimize for throughput, not fairness. As a result, bias enters early through exclusionary job descriptions and continues later through identity-heavy resume review.

This project takes a different approach: fairness is treated as a workflow constraint. The product is designed so that better hiring behavior is the default path.

## What Makes This Different

This is not just:

- a resume parser
- a prompt wrapper around an LLM
- a dashboard that displays bias scores after the fact

It is a full workflow product with three connected controls:

1. `Bias-aware job design`
   The platform reviews postings while they are being drafted.
2. `Blind applicant intake`
   Resumes are parsed and redacted before HR review.
3. `Accountable contact disclosure`
   Identity access is delayed until a recruiter deliberately requests it.

## Core User Flows

### HR user

- register or sign in
- create a job posting
- receive live fairness feedback
- save the posting and view analytics
- review anonymized candidates
- shortlist, reject, or reveal contact

### Applicant user

- register or sign in
- browse open roles
- review real job details
- upload a resume
- track application status

## Architecture Decisions

### 1. Separate identity storage

The system stores applicant identity in `identity_schema` instead of mixing it directly into the main review workflow. This supports a cleaner privacy boundary between:

- candidate evaluation
- direct identity access

### 2. Structured outputs over free-form AI text

The OpenAI-backed features use structured outputs so the application can treat model responses as reliable product inputs rather than raw chat text.

### 3. Heuristic fallback

LLM features improve quality, but the app should not fail when the API key is missing or the model path is unavailable. Each major AI feature has a fallback path.

### 4. Product-first fairness

The system does not promise perfect bias removal. Instead, it uses:

- better UX defaults
- deliberate gating
- cleaner information boundaries
- visible explanations and audit history

## Technical Summary

- `Frontend`: React, TypeScript, Vite
- `Backend`: Express, TypeScript
- `Database`: PostgreSQL
- `AI`: OpenAI Responses API with structured outputs
- `Resume ingestion`: PDF and DOCX parsing
- `Reporting`: PDF ethics report generation

## Why This Is A Strong Demo Project

- It solves a real workflow problem.
- It has clear business relevance.
- It shows thoughtful system design, not just model usage.
- It demonstrates full-stack execution across frontend, backend, database, and AI integration.
- It makes fairness visible through product behavior rather than marketing language.
