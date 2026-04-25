import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { Shell } from "../components/Shell";

interface JobPosting {
  id: string;
  title: string;
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
      <section className="panel panel--wide">
        {overview ? (
          <div className="stats-grid">
            <article className="card">
              <span className="card__label">Average score</span>
              <h2>{overview.averageScore ?? "N/A"}</h2>
            </article>
            <article className="card">
              <span className="card__label">Open postings</span>
              <h2>{overview.totalJobPostings}</h2>
            </article>
            <article className="card">
              <span className="card__label">Issue mix</span>
              <p>
                Critical {overview.totalIssuesBySeverity.critical} · Warning{" "}
                {overview.totalIssuesBySeverity.warning} · Suggestion{" "}
                {overview.totalIssuesBySeverity.suggestion}
              </p>
            </article>
          </div>
        ) : null}
        <div className="actions">
          <Link className="button" to="/hr/editor">
            Create new posting
          </Link>
        </div>
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="list">
          {postings.map((posting) => (
            <article className="list-item" key={posting.id}>
              <div>
                <h2>{posting.title}</h2>
                <p>
                  {posting.status} · score {posting.compliance_score}
                </p>
              </div>
              <div className="stack">
                <span>{new Date(posting.updated_at).toLocaleString()}</span>
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
        {topIssues.length ? (
          <div className="subpanel">
            <h2>Top issue types</h2>
            <div className="list">
              {topIssues.map((issue) => (
                <article className="list-item" key={issue.type}>
                  <strong>{issue.type.split("_").join(" ")}</strong>
                  <span>{issue.count}</span>
                </article>
              ))}
            </div>
          </div>
        ) : null}
        {trends.length ? (
          <div className="subpanel">
            <h2>Score trend</h2>
            <div className="list">
              {trends.map((point) => (
                <article className="list-item" key={point.bucket}>
                  <strong>{new Date(point.bucket).toLocaleDateString()}</strong>
                  <span>{point.average_score}</span>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </Shell>
  );
}
