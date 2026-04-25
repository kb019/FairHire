import crypto from "node:crypto";
import multer from "multer";
import { Router } from "express";
import { parseResumeBuffer } from "../analyzer/resumeParser.js";
import { redactParsedResume } from "../analyzer/redactor.js";
import { query, contactDisclosurePool } from "../db/client.js";
import { requireApplicant, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const resumesRouter = Router();

resumesRouter.get(
  "/my",
  requireAuth,
  requireApplicant,
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        SELECT
          resumes.id,
          resumes.job_posting_id,
          resumes.anonymous_id,
          resumes.submitted_at,
          resumes.review_status,
          resumes.status,
          job_postings.title,
          job_postings.industry_category,
          job_postings.department,
          job_postings.location,
          job_postings.employment_type,
          job_postings.compensation_range,
          CASE
            WHEN char_length(job_postings.content) > 220 THEN LEFT(job_postings.content, 220) || '...'
            ELSE job_postings.content
          END AS posting_excerpt,
          EXISTS (
            SELECT 1
            FROM contact_disclosure_log
            WHERE contact_disclosure_log.job_posting_id = resumes.job_posting_id
              AND contact_disclosure_log.anonymous_id = resumes.anonymous_id
          ) AS contact_requested
        FROM resumes
        INNER JOIN job_postings ON job_postings.id = resumes.job_posting_id
        WHERE resumes.applicant_id = $1
        ORDER BY resumes.submitted_at DESC
      `,
      [req.user!.userId]
    );

    res.json(result.rows);
  })
);

resumesRouter.post(
  "/",
  requireAuth,
  requireApplicant,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const jobPostingId = String(req.body.jobPostingId ?? "").trim();
    const file = req.file;

    if (!jobPostingId) {
      res.status(400).json({ error: "jobPostingId is required." });
      return;
    }

    if (!file) {
      res.status(400).json({ error: "Resume file is required." });
      return;
    }

    if (!allowedMimeTypes.has(file.mimetype)) {
      res.status(400).json({ error: "Only PDF and DOCX resumes are accepted." });
      return;
    }

    const applicantResult = await query<{ anonymous_id: string }>(
      "SELECT anonymous_id FROM applicants WHERE id = $1",
      [req.user!.userId]
    );

    if (!applicantResult.rowCount) {
      res.status(404).json({ error: "Applicant account not found." });
      return;
    }

    const postingResult = await query<{ id: string }>(
      "SELECT id FROM job_postings WHERE id = $1 AND status <> 'archived'",
      [jobPostingId]
    );

    if (!postingResult.rowCount) {
      res.status(404).json({ error: "Job posting not found." });
      return;
    }

    const parsedResume = await parseResumeBuffer(file.buffer, file.mimetype);
    const anonymousId = applicantResult.rows[0].anonymous_id;
    const { redactedResume, contact } = redactParsedResume(parsedResume, anonymousId);
    const fileHash = crypto.createHash("sha256").update(file.buffer).digest("hex");

    if (contact.email || contact.phone) {
      await contactDisclosurePool.query(
        `
          INSERT INTO identity_schema.applicant_identity (applicant_id, email, phone)
          VALUES ($1, COALESCE($2, ''), $3)
          ON CONFLICT (applicant_id)
          DO UPDATE SET
            email = CASE WHEN EXCLUDED.email = '' THEN identity_schema.applicant_identity.email ELSE EXCLUDED.email END,
            phone = COALESCE(EXCLUDED.phone, identity_schema.applicant_identity.phone)
        `,
        [req.user!.userId, contact.email, contact.phone]
      );
    }

    const insertResult = await query<{ id: string }>(
      `
        INSERT INTO resumes (applicant_id, job_posting_id, anonymous_id, redacted_content, raw_file_hash, status, review_status)
        VALUES ($1, $2, $3, $4::jsonb, $5, 'processed', 'submitted')
        RETURNING id
      `,
      [req.user!.userId, jobPostingId, anonymousId, JSON.stringify(redactedResume), fileHash]
    );

    res.status(201).json({
      id: insertResult.rows[0].id,
      message: "Resume received.",
    });
  })
);
