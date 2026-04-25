import { Router } from "express";
import { analyzeJobPosting } from "../analyzer/jobPostingAnalyzer.js";
import { calculateComplianceScore } from "../analyzer/scoreCalculator.js";
import { validJobPostingCategories, type JobPostingCategory } from "../constants/jobPostingCategories.js";
import { query } from "../db/client.js";
import { requireAuth, requireHr } from "../middleware/auth.js";
import type { Issue } from "../types/api.js";
import { asyncHandler } from "../utils/http.js";
import { buildEthicsReportPdf } from "../utils/report.js";

interface JobPostingInput {
  title: string;
  industryCategory?: string;
  department?: string;
  location?: string;
  employmentType?: string;
  compensationRange?: string;
  content: string;
  status?: string;
}

function normalizeIndustryCategory(value: string | undefined): JobPostingCategory {
  const normalized = String(value ?? "general_business").trim() as JobPostingCategory;
  return validJobPostingCategories.has(normalized) ? normalized : "general_business";
}

async function verifyOwnership(jobPostingId: string, hrUserId: string) {
  const result = await query<{ id: string }>(
    "SELECT id FROM job_postings WHERE id = $1 AND hr_user_id = $2",
    [jobPostingId, hrUserId]
  );

  return Boolean(result.rowCount);
}

export const jobPostingsRouter = Router();

jobPostingsRouter.get(
  "/public",
  asyncHandler(async (_req, res) => {
    const result = await query(
      `
        SELECT id, title, industry_category, department, location, employment_type, compensation_range, compliance_score, created_at
        FROM job_postings
        WHERE status <> 'archived'
        ORDER BY created_at DESC
      `
    );

    res.json(result.rows);
  })
);

jobPostingsRouter.use(requireAuth, requireHr);

jobPostingsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        SELECT id, title, industry_category, department, location, employment_type, compensation_range, status, compliance_score, created_at, updated_at
        FROM job_postings
        WHERE hr_user_id = $1
        ORDER BY updated_at DESC
      `,
      [req.user!.userId]
    );

    res.json(result.rows);
  })
);

jobPostingsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = req.body as JobPostingInput;
    const title = String(body.title ?? "").trim();
    const industryCategory = normalizeIndustryCategory(body.industryCategory);
    const content = String(body.content ?? "").trim();

    if (!title || !content) {
      res.status(400).json({ error: "Title and content are required." });
      return;
    }

    const analysis = await analyzeJobPosting(content);
    const insertResult = await query<{ id: string }>(
      `
        INSERT INTO job_postings (
          hr_user_id,
          title,
          industry_category,
          department,
          location,
          employment_type,
          compensation_range,
          content,
          status,
          compliance_score
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `,
      [
        req.user!.userId,
        title,
        industryCategory,
        body.department ?? null,
        body.location ?? null,
        body.employmentType ?? null,
        body.compensationRange ?? null,
        content,
        body.status ?? "draft",
        analysis.score,
      ]
    );

    const jobPostingId = insertResult.rows[0].id;

    await query(
      "INSERT INTO ethics_reports (job_posting_id, issues, score) VALUES ($1, $2::jsonb, $3)",
      [jobPostingId, JSON.stringify(analysis.issues), analysis.score]
    );

    await query("INSERT INTO score_history (job_posting_id, score) VALUES ($1, $2)", [
      jobPostingId,
      analysis.score,
    ]);

    res.status(201).json({
      id: jobPostingId,
      score: analysis.score,
      issues: analysis.issues,
    });
  })
);

jobPostingsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const jobPostingId = String(req.params.id);
    const isOwner = await verifyOwnership(jobPostingId, req.user!.userId);

    if (!isOwner) {
      res.status(404).json({ error: "Job posting not found." });
      return;
    }

    const postingResult = await query(
      `
        SELECT id, title, industry_category, department, location, employment_type, compensation_range, content, status, compliance_score, created_at, updated_at
        FROM job_postings
        WHERE id = $1
      `,
      [jobPostingId]
    );

    const reportResult = await query(
      `
        SELECT id, issues, score, created_at
        FROM ethics_reports
        WHERE job_posting_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [jobPostingId]
    );

    res.json({
      ...postingResult.rows[0],
      report: reportResult.rows[0] ?? null,
    });
  })
);

jobPostingsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const jobPostingId = String(req.params.id);
    const isOwner = await verifyOwnership(jobPostingId, req.user!.userId);

    if (!isOwner) {
      res.status(404).json({ error: "Job posting not found." });
      return;
    }

    const body = req.body as JobPostingInput;
    const title = String(body.title ?? "").trim();
    const industryCategory = normalizeIndustryCategory(body.industryCategory);
    const content = String(body.content ?? "").trim();

    if (!title || !content) {
      res.status(400).json({ error: "Title and content are required." });
      return;
    }

    const analysis = await analyzeJobPosting(content);

    await query(
      `
        UPDATE job_postings
        SET
          title = $2,
          industry_category = $3,
          department = $4,
          location = $5,
          employment_type = $6,
          compensation_range = $7,
          content = $8,
          status = $9,
          compliance_score = $10,
          updated_at = now()
        WHERE id = $1
      `,
      [
        jobPostingId,
        title,
        industryCategory,
        body.department ?? null,
        body.location ?? null,
        body.employmentType ?? null,
        body.compensationRange ?? null,
        content,
        body.status ?? "draft",
        analysis.score,
      ]
    );

    await query(
      "INSERT INTO ethics_reports (job_posting_id, issues, score) VALUES ($1, $2::jsonb, $3)",
      [jobPostingId, JSON.stringify(analysis.issues), analysis.score]
    );

    await query("INSERT INTO score_history (job_posting_id, score) VALUES ($1, $2)", [jobPostingId, analysis.score]);

    res.json({
      id: jobPostingId,
      score: analysis.score,
      issues: analysis.issues,
    });
  })
);

jobPostingsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const jobPostingId = String(req.params.id);
    const isOwner = await verifyOwnership(jobPostingId, req.user!.userId);

    if (!isOwner) {
      res.status(404).json({ error: "Job posting not found." });
      return;
    }

    await query(
      `
        UPDATE job_postings
        SET status = 'archived', updated_at = now()
        WHERE id = $1
      `,
      [jobPostingId]
    );

    res.status(204).send();
  })
);

jobPostingsRouter.get(
  "/:id/history",
  asyncHandler(async (req, res) => {
    const jobPostingId = String(req.params.id);
    const isOwner = await verifyOwnership(jobPostingId, req.user!.userId);

    if (!isOwner) {
      res.status(404).json({ error: "Job posting not found." });
      return;
    }

    const result = await query(
      `
        SELECT id, score, recorded_at
        FROM score_history
        WHERE job_posting_id = $1
        ORDER BY recorded_at ASC
      `,
      [jobPostingId]
    );

    res.json(result.rows);
  })
);

jobPostingsRouter.get(
  "/:id/report",
  asyncHandler(async (req, res) => {
    const jobPostingId = String(req.params.id);
    const isOwner = await verifyOwnership(jobPostingId, req.user!.userId);

    if (!isOwner) {
      res.status(404).json({ error: "Job posting not found." });
      return;
    }

    const postingResult = await query<{ title: string; compliance_score: number }>(
      "SELECT title, compliance_score FROM job_postings WHERE id = $1",
      [jobPostingId]
    );
    const reportResult = await query<{ issues: Issue[] }>(
      `
        SELECT issues
        FROM ethics_reports
        WHERE job_posting_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [jobPostingId]
    );

    const posting = postingResult.rows[0];
    const issues = (reportResult.rows[0]?.issues ?? []) as Issue[];
    const pdfBuffer = await buildEthicsReportPdf(posting.title, posting.compliance_score, issues);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="ethics-report-${jobPostingId}.pdf"`);
    res.send(pdfBuffer);
  })
);

jobPostingsRouter.put(
  "/:id/report/issues/:issueId/acknowledge",
  asyncHandler(async (req, res) => {
    const jobPostingId = String(req.params.id);
    const issueId = String(req.params.issueId);
    const isOwner = await verifyOwnership(jobPostingId, req.user!.userId);
    const justification = String(req.body.justification ?? "").trim();

    if (!isOwner) {
      res.status(404).json({ error: "Job posting not found." });
      return;
    }

    if (!justification) {
      res.status(400).json({ error: "A written justification is required." });
      return;
    }

    const reportResult = await query<{ id: string; issues: Issue[] }>(
      `
        SELECT id, issues
        FROM ethics_reports
        WHERE job_posting_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [jobPostingId]
    );

    if (!reportResult.rowCount) {
      res.status(404).json({ error: "Ethics report not found." });
      return;
    }

    const report = reportResult.rows[0];
    const updatedIssues = (report.issues as Issue[]).map((issue) =>
      issue.id === issueId
        ? { ...issue, acknowledged: true, acknowledgement_note: justification }
        : issue
    );
    const recalculatedScore = calculateComplianceScore(updatedIssues);

    await query("UPDATE ethics_reports SET issues = $2::jsonb, score = $3 WHERE id = $1", [
      report.id,
      JSON.stringify(updatedIssues),
      recalculatedScore,
    ]);
    await query("UPDATE job_postings SET compliance_score = $2, updated_at = now() WHERE id = $1", [
      jobPostingId,
      recalculatedScore,
    ]);
    await query("INSERT INTO score_history (job_posting_id, score) VALUES ($1, $2)", [
      jobPostingId,
      recalculatedScore,
    ]);

    res.json({
      score: recalculatedScore,
      issues: updatedIssues,
    });
  })
);
