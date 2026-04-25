import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Shell } from "../components/Shell";
import { getJobPostingCategoryLabel } from "../constants/jobPostingCategories";

interface JobPosting {
  id: string;
  title: string;
  industry_category: string;
  status: string;
  compliance_score: number;
  updated_at: string;
}

interface Overview {
  averageScore: number | null;
  totalIssuesBySeverity: {
    critical: number;
    warning: number;
    suggestion: number;
  };
  totalJobPostings: number;
}

export function HRDashboardPage() {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [topIssues, setTopIssues] = useState<Array<{ type: string; count: number }>>([]);
  const [trends, setTrends] = useState<Array<{ bucket: string; average_score: number }>>([]);
  const [error, setError] = useState("");
  const [downloadingReportId, setDownloadingReportId] = useState("");

  useEffect(() => {
    api
      .get("/job-postings")
      .then((response) => setPostings(response.data))
      .catch((dashboardError) => {
        setError(dashboardError.response?.data?.error ?? "Could not load job postings.");
      });

    api.get("/analytics/overview").then((response) => setOverview(response.data)).catch(() => undefined);
    api.get("/analytics/top-issues").then((response) => setTopIssues(response.data)).catch(() => undefined);
    api.get("/analytics/trends").then((response) => setTrends(response.data)).catch(() => undefined);
  }, []);

  async function downloadReport(jobPostingId: string) {
    setError("");
    setDownloadingReportId(jobPostingId);

    try {
      const response = await api.get(`/job-postings/${jobPostingId}/report`, {
        responseType: "blob",
      });
      const objectUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = `ethics-report-${jobPostingId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (downloadError: any) {
      setError(downloadError.response?.data?.error ?? "Could not download the ethics report.");
    } finally {
      setDownloadingReportId("");
    }
  }

  return (
    <Shell title="HR dashboard">
      <section className="panel panel--wide workspace-shell">
        <div className="workspace-grid">
          <div className="workspace-primary">
            <section className="workspace-panel workspace-panel--hero">
              <div className="workspace-panel__header">
                <div>
                  <span className="section-kicker">Hiring operations</span>
                  <h2>Active job postings</h2>
                  <p>Track compliance health, keep job content clean, and move into anonymous review from one place.</p>
                </div>
                <Link className="button" to="/hr/editor">
                  Create new posting
                </Link>
              </div>
              {overview ? (
                <div className="workspace-stat-grid">
                  <article className="workspace-stat-card">
                    <span>Average score</span>
                    <strong>{overview.averageScore ?? "N/A"}</strong>
                  </article>
                  <article className="workspace-stat-card">
                    <span>Open postings</span>
                    <strong>{overview.totalJobPostings}</strong>
                  </article>
                  <article className="workspace-stat-card">
                    <span>Critical issues</span>
                    <strong>{overview.totalIssuesBySeverity.critical}</strong>
                  </article>
                  <article className="workspace-stat-card">
                    <span>Warnings</span>
                    <strong>{overview.totalIssuesBySeverity.warning}</strong>
                  </article>
                </div>
              ) : null}
            </section>

            <section className="workspace-panel">
              <div className="workspace-panel__header">
                <div>
                  <span className="section-kicker">Posting queue</span>
                  <h2>Current roles</h2>
                </div>
              </div>
              {error ? <p className="feedback feedback--error">{error}</p> : null}
              <div className="workspace-list">
                {postings.map((posting) => (
                  <article className="workspace-list-card" key={posting.id}>
                    <div className="workspace-list-card__top">
                      <div>
                        <strong>{posting.title}</strong>
                        <p>{getJobPostingCategoryLabel(posting.industry_category)}</p>
                      </div>
                      <div className="workspace-list-card__meta">
                        <span className="workspace-badge">Score {posting.compliance_score}</span>
                        <span className="workspace-badge workspace-badge--muted">{posting.status}</span>
                      </div>
                    </div>
                    <div className="workspace-list-card__footer">
                      <span>Updated {new Date(posting.updated_at).toLocaleString()}</span>
                      <div className="actions actions--compact">
                        <Link className="button button--ghost" to={`/hr/job-postings/${posting.id}`}>
                          Review candidates
                        </Link>
                        <button
                          className="button button--ghost"
                          disabled={downloadingReportId === posting.id}
                          onClick={() => void downloadReport(posting.id)}
                          type="button"
                        >
                          {downloadingReportId === posting.id ? "Downloading..." : "Report"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
                {!postings.length && !error ? (
                  <p className="feedback">No job postings yet. Create the first one to start analysis.</p>
                ) : null}
              </div>
            </section>
          </div>

          <aside className="workspace-sidebar">
            {topIssues.length ? (
              <section className="workspace-panel">
                <div className="workspace-panel__header">
                  <div>
                    <span className="section-kicker">Issue patterns</span>
                    <h2>Top issue types</h2>
                  </div>
                </div>
                <div className="workspace-mini-list">
                  {topIssues.map((issue) => (
                    <article className="workspace-mini-item" key={issue.type}>
                      <strong>{issue.type.split("_").join(" ")}</strong>
                      <span>{issue.count}</span>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {trends.length ? (
              <section className="workspace-panel">
                <div className="workspace-panel__header">
                  <div>
                    <span className="section-kicker">Trendline</span>
                    <h2>Score trend</h2>
                  </div>
                </div>
                <div className="workspace-mini-list">
                  {trends.map((point) => (
                    <article className="workspace-mini-item" key={point.bucket}>
                      <strong>{new Date(point.bucket).toLocaleDateString()}</strong>
                      <span>{point.average_score}</span>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </section>
    </Shell>
  );
}
