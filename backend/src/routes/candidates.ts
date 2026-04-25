import { Router } from "express";
import { analyzeCandidateFit } from "../analyzer/candidateFitSnapshot.js";
import { contactDisclosurePool, query } from "../db/client.js";
import { requireAuth, requireHr } from "../middleware/auth.js";
import type { RedactedResume } from "../types/api.js";
import { asyncHandler } from "../utils/http.js";

function sanitizeCandidateResumeForReview(redactedContent: RedactedResume) {
  return {
    ...redactedContent,
    education: (redactedContent.education ?? []).map((item) => ({
      ...item,
      institution: item.institution ? "Institution withheld" : "",
    })),
  };
}

async function verifyOwnership(jobPostingId: string, hrUserId: string) {
  const result = await query<{ id: string }>(
    "SELECT id FROM job_postings WHERE id = $1 AND hr_user_id = $2",
    [jobPostingId, hrUserId]
  );

  return Boolean(result.rowCount);
}

export const candidatesRouter = Router();

candidatesRouter.use(requireAuth, requireHr);

candidatesRouter.get(
  "/:id/candidates",
  asyncHandler(async (req, res) => {
    const jobPostingId = String(req.params.id);
    const isOwner = await verifyOwnership(jobPostingId, req.user!.userId);

    if (!isOwner) {
      res.status(404).json({ error: "Job posting not found." });
      return;
    }

    const result = await query(
      `
        SELECT
          DISTINCT ON (resumes.anonymous_id)
          resumes.id,
          resumes.anonymous_id,
          resumes.review_status,
          resumes.submitted_at,
          resumes.redacted_content,
          EXISTS (
            SELECT 1
            FROM contact_disclosure_log
            WHERE contact_disclosure_log.job_posting_id = resumes.job_posting_id
              AND contact_disclosure_log.anonymous_id = resumes.anonymous_id
          ) AS contact_revealed
        FROM resumes
        WHERE resumes.job_posting_id = $1
        ORDER BY resumes.anonymous_id, resumes.submitted_at DESC
      `,
      [jobPostingId]
    );

    res.json(
      result.rows.map((row: any) => ({
        id: row.id,
        anonymous_id: row.anonymous_id,
        review_status: row.review_status,
        submitted_at: row.submitted_at,
        contact_revealed: row.contact_revealed,
        skills: row.redacted_content.skills ?? [],
        experience_count: row.redacted_content.experience?.length ?? 0,
      }))
    );
  })
);

candidatesRouter.get(
  "/:id/candidates/:anonymousId",
  asyncHandler(async (req, res) => {
    const jobPostingId = String(req.params.id);
    const anonymousId = decodeURIComponent(String(req.params.anonymousId));
    const isOwner = await verifyOwnership(jobPostingId, req.user!.userId);

    if (!isOwner) {
      res.status(404).json({ error: "Job posting not found." });
      return;
    }

    const result = await query(
      `
        SELECT
          resumes.id,
          resumes.anonymous_id,
          resumes.redacted_content,
          resumes.review_status,
          resumes.submitted_at,
          job_postings.title,
          job_postings.industry_category,
          job_postings.department,
          job_postings.location,
          job_postings.employment_type,
          job_postings.compensation_range,
          job_postings.content
        FROM resumes
        INNER JOIN job_postings ON job_postings.id = resumes.job_posting_id
        WHERE job_posting_id = $1 AND anonymous_id = $2
        ORDER BY submitted_at DESC
        LIMIT 1
      `,
      [jobPostingId, anonymousId]
    );

    if (!result.rowCount) {
      res.status(404).json({ error: "Candidate not found." });
      return;
    }

    const row = result.rows[0] as any;
    const redactedContent = sanitizeCandidateResumeForReview(row.redacted_content as RedactedResume);
    const fitSnapshot = await analyzeCandidateFit(
      {
        title: row.title,
        industryCategory: row.industry_category,
        department: row.department,
        location: row.location,
        employmentType: row.employment_type,
        compensationRange: row.compensation_range,
        content: row.content,
      },
      redactedContent
    );

    res.json({
      id: row.id,
      anonymous_id: row.anonymous_id,
      review_status: row.review_status,
      submitted_at: row.submitted_at,
      redacted_content: redactedContent,
      fit_snapshot: fitSnapshot,
    });
  })
);

candidatesRouter.put(
  "/:id/candidates/:anonymousId/status",
  asyncHandler(async (req, res) => {
    const jobPostingId = String(req.params.id);
    const anonymousId = decodeURIComponent(String(req.params.anonymousId));
    const reviewStatus = String(req.body.status ?? "").trim();
    const isOwner = await verifyOwnership(jobPostingId, req.user!.userId);

    if (!isOwner) {
      res.status(404).json({ error: "Job posting not found." });
      return;
    }

    if (!["shortlisted", "rejected", "submitted"].includes(reviewStatus)) {
      res.status(400).json({ error: "Status must be submitted, shortlisted, or rejected." });
      return;
    }

    await query(
      `
        UPDATE resumes
        SET review_status = $3
        WHERE job_posting_id = $1 AND anonymous_id = $2
      `,
      [jobPostingId, anonymousId, reviewStatus]
    );

    res.json({ anonymousId, status: reviewStatus });
  })
);

candidatesRouter.post(
  "/:id/candidates/:anonymousId/request-contact",
  asyncHandler(async (req, res) => {
    const jobPostingId = String(req.params.id);
    const anonymousId = decodeURIComponent(String(req.params.anonymousId));
    const isOwner = await verifyOwnership(jobPostingId, req.user!.userId);

    if (!isOwner) {
      res.status(404).json({ error: "Job posting not found." });
      return;
    }

    const resumeResult = await query<{ applicant_id: string }>(
      `
        SELECT applicant_id
        FROM resumes
        WHERE job_posting_id = $1 AND anonymous_id = $2
        ORDER BY submitted_at DESC
        LIMIT 1
      `,
      [jobPostingId, anonymousId]
    );

    if (!resumeResult.rowCount) {
      res.status(404).json({ error: "Candidate not found." });
      return;
    }

    const applicantId = resumeResult.rows[0].applicant_id;
    const contactResult = await contactDisclosurePool.query<{ email: string; phone: string | null }>(
      `
        SELECT email, phone
        FROM identity_schema.applicant_identity
        WHERE applicant_id = $1
      `,
      [applicantId]
    );

    if (!contactResult.rowCount) {
      res.status(404).json({ error: "Contact information not found." });
      return;
    }

    await query(
      `
        INSERT INTO contact_disclosure_log (hr_user_id, anonymous_id, job_posting_id)
        VALUES ($1, $2, $3)
      `,
      [req.user!.userId, anonymousId, jobPostingId]
    );

    res.json({
      email: contactResult.rows[0].email,
      phone: contactResult.rows[0].phone,
    });
  })
);
