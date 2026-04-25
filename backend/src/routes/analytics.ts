import { Router } from "express";
import type { Issue } from "../types/api.js";
import { query } from "../db/client.js";
import { requireAuth, requireHr } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth, requireHr);

analyticsRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const postingsResult = await query(
      `
        SELECT id, compliance_score
        FROM job_postings
        WHERE hr_user_id = $1 AND status <> 'archived'
      `,
      [req.user!.userId]
    );

    const postingIds = postingsResult.rows.map((row: any) => row.id);

    if (!postingIds.length) {
      res.json({
        averageScore: null,
        totalIssuesBySeverity: { critical: 0, warning: 0, suggestion: 0 },
        totalJobPostings: 0,
      });
      return;
    }

    const reportsResult = await query<{ issues: Issue[] }>(
      `
        SELECT DISTINCT ON (job_posting_id) issues
        FROM ethics_reports
        WHERE job_posting_id = ANY($1::uuid[])
        ORDER BY job_posting_id, created_at DESC
      `,
      [postingIds]
    );

    const totals = { critical: 0, warning: 0, suggestion: 0 };

    for (const report of reportsResult.rows) {
      for (const issue of report.issues as Issue[]) {
        if (!issue.acknowledged) {
          totals[issue.severity] += 1;
        }
      }
    }

    const averageScore =
      postingsResult.rows.reduce((sum: number, row: any) => sum + Number(row.compliance_score ?? 0), 0) /
      postingsResult.rows.length;

    res.json({
      averageScore: Math.round(averageScore),
      totalIssuesBySeverity: totals,
      totalJobPostings: postingsResult.rows.length,
    });
  })
);

analyticsRouter.get(
  "/trends",
  asyncHandler(async (req, res) => {
    const result = await query(
      `
        SELECT
          date_trunc('day', score_history.recorded_at) AS bucket,
          ROUND(AVG(score_history.score))::int AS average_score
        FROM score_history
        INNER JOIN job_postings ON job_postings.id = score_history.job_posting_id
        WHERE job_postings.hr_user_id = $1
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      [req.user!.userId]
    );

    res.json(result.rows);
  })
);

analyticsRouter.get(
  "/top-issues",
  asyncHandler(async (req, res) => {
    const postingsResult = await query(
      `
        SELECT id
        FROM job_postings
        WHERE hr_user_id = $1 AND status <> 'archived'
      `,
      [req.user!.userId]
    );

    const postingIds = postingsResult.rows.map((row: any) => row.id);

    if (!postingIds.length) {
      res.json([]);
      return;
    }

    const reportsResult = await query<{ issues: Issue[] }>(
      `
        SELECT DISTINCT ON (job_posting_id) issues
        FROM ethics_reports
        WHERE job_posting_id = ANY($1::uuid[])
        ORDER BY job_posting_id, created_at DESC
      `,
      [postingIds]
    );

    const counts = new Map<string, number>();

    for (const report of reportsResult.rows) {
      for (const issue of report.issues as Issue[]) {
        if (!issue.acknowledged) {
          counts.set(issue.type, (counts.get(issue.type) ?? 0) + 1);
        }
      }
    }

    res.json(
      Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }))
    );
  })
);
