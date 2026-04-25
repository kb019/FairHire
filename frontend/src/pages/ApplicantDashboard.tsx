import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { Shell } from "../components/Shell";
import { getJobPostingCategoryLabel } from "../constants/jobPostingCategories";

interface PublicJobPosting {
  id: string;
  title: string;
  industry_category: string;
  department: string | null;
  location: string | null;
  employment_type: string | null;
  compensation_range: string | null;
  content: string;
}

interface SubmissionTrackerItem {
  id: string;
  job_posting_id: string;
  anonymous_id: string;
  submitted_at: string;
  review_status: string;
  status: string;
  title: string;
  industry_category: string;
  department: string | null;
  location: string | null;
  employment_type: string | null;
  compensation_range: string | null;
  posting_excerpt: string;
  contact_requested: boolean;
}

function formatReviewStatus(status: string) {
  if (status === "shortlisted") {
    return "Shortlisted";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  return "Submitted";
}

function getStatusTone(status: string) {
  if (status === "shortlisted") {
    return "good";
  }

  if (status === "rejected") {
    return "bad";
  }

  return "neutral";
}

function formatProcessingStatus(status: string) {
  if (status === "processed") {
    return "Processed";
  }

  if (status === "pending") {
    return "Pending";
  }

  return status ? `${status.charAt(0).toUpperCase()}${status.slice(1)}` : "Unknown";
}

export function ApplicantDashboardPage() {
  const [jobPostings, setJobPostings] = useState<PublicJobPosting[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionTrackerItem[]>([]);
  const [selectedJobPostingId, setSelectedJobPostingId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selectedPosting = jobPostings.find((posting) => posting.id === selectedJobPostingId) ?? null;

  useEffect(() => {
    api.get("/job-postings/public").then((response) => {
      setJobPostings(response.data);
      if (response.data[0]?.id) {
        setSelectedJobPostingId(response.data[0].id);
      }
    });

    api.get("/resumes/my").then((response) => setSubmissions(response.data)).catch(() => undefined);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedJobPostingId || !file) {
      setError("Select a job posting and attach a PDF or DOCX resume.");
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData();
      formData.append("jobPostingId", selectedJobPostingId);
      formData.append("file", file);
      await api.post("/resumes", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setMessage("Resume received.");
      const refreshed = await api.get("/resumes/my");
      setSubmissions(refreshed.data);
    } catch (submissionError: any) {
      setError(submissionError.response?.data?.error ?? "Resume upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Job opportunities"
      eyebrow="Applicant portal"
      description="Browse active roles, review compensation and job details, and track every application from one clean portal."
    >
      <section className="panel panel--wide recruiting-shell">
        <div className="recruiting-toolbar">
          <div>
            <span className="section-kicker">Candidate portal</span>
            <h2>Explore roles, review details, and apply with one resume workflow.</h2>
          </div>
          <div className="recruiting-toolbar__stats">
            <span className="workspace-badge">{jobPostings.length} open roles</span>
            <span className="workspace-badge workspace-badge--muted">{submissions.length} applications</span>
          </div>
        </div>

        <div className="recruiting-browser">
          <aside className="jobs-rail">
            <div className="jobs-rail__header">
              <span className="section-kicker">Open positions</span>
              <h3>Available jobs</h3>
            </div>
            <div className="jobs-rail__list">
              {jobPostings.map((posting) => {
                const isSelected = posting.id === selectedJobPostingId;

                return (
                  <button
                    className={isSelected ? "job-rail-card job-rail-card--selected" : "job-rail-card"}
                    key={posting.id}
                    onClick={() => setSelectedJobPostingId(posting.id)}
                    type="button"
                  >
                    <div className="job-rail-card__top">
                      <strong>{posting.title}</strong>
                      <span className="workspace-badge workspace-badge--muted">
                        {getJobPostingCategoryLabel(posting.industry_category)}
                      </span>
                    </div>
                    <div className="job-rail-card__meta">
                      <span>{posting.department || "Department not listed"}</span>
                      <span>{posting.location || "Location not listed"}</span>
                    </div>
                    <div className="job-rail-card__footer">
                      <span>{posting.compensation_range || "Compensation not listed"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="job-detail-stage">
            {selectedPosting ? (
              <>
                <div className="job-detail-hero">
                  <div className="job-detail-hero__copy">
                    <span className="section-kicker">Job details</span>
                    <h2>{selectedPosting.title}</h2>
                    <p>Review the role, team context, and compensation before you apply.</p>
                  </div>
                  <div className="job-detail-hero__meta">
                    <span className="job-pill">{getJobPostingCategoryLabel(selectedPosting.industry_category)}</span>
                    {selectedPosting.employment_type ? <span className="job-pill">{selectedPosting.employment_type}</span> : null}
                    {selectedPosting.department ? <span className="job-pill">{selectedPosting.department}</span> : null}
                  </div>
                </div>

                <div className="job-summary-grid">
                  <article className="job-summary-card">
                    <span>Location</span>
                    <strong>{selectedPosting.location || "Not listed"}</strong>
                  </article>
                  <article className="job-summary-card">
                    <span>Compensation</span>
                    <strong>{selectedPosting.compensation_range || "Not listed"}</strong>
                  </article>
                  <article className="job-summary-card">
                    <span>Department</span>
                    <strong>{selectedPosting.department || "Not listed"}</strong>
                  </article>
                  <article className="job-summary-card">
                    <span>Schedule</span>
                    <strong>{selectedPosting.employment_type || "Not listed"}</strong>
                  </article>
                </div>

                <section className="job-description-panel">
                  <div className="applicant-section-header">
                    <h3>Job description</h3>
                  </div>
                  <p className="applicant-description-text">{selectedPosting.content || "No description available."}</p>
                </section>
              </>
            ) : (
              <div className="applicant-posting-empty">
                <span className="section-kicker">Job details</span>
                <h2>Select a job</h2>
                <p>Choose a role from the left to review the posting before you apply.</p>
              </div>
            )}
          </section>

          <aside className="application-sidebar">
            <form className="apply-card" onSubmit={handleSubmit}>
              <div className="apply-card__header">
                <span className="section-kicker">Apply now</span>
                <h3>{selectedPosting ? `Apply for ${selectedPosting.title}` : "Apply to a role"}</h3>
              </div>
              <label className="field">
                <span>Selected posting</span>
                <input readOnly type="text" value={selectedPosting ? selectedPosting.title : "Choose a role first"} />
              </label>
              <label className="field">
                <span>Resume file</span>
                <input
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>
              {message ? <p className="feedback feedback--success">{message}</p> : null}
              {error ? <p className="feedback feedback--error">{error}</p> : null}
              <button className="button" disabled={busy || !selectedJobPostingId} type="submit">
                {busy ? "Submitting..." : "Submit application"}
              </button>
            </form>

            <section className="application-history-panel">
              <div className="applicant-section-header">
                <div>
                  <span className="section-kicker">Application history</span>
                  <h3>Your submissions</h3>
                </div>
                <span className="candidate-list-summary">{submissions.length} total</span>
              </div>
              <div className="applicant-tracker-list">
                {submissions.map((submission) => (
                  <article className="applicant-tracker-card" key={submission.id}>
                    <div className="applicant-tracker-card__top">
                      <div>
                        <strong>{submission.title}</strong>
                        <p>{submission.anonymous_id}</p>
                      </div>
                      <span className={`status-pill status-pill--${getStatusTone(submission.review_status)}`}>
                        {formatReviewStatus(submission.review_status)}
                      </span>
                    </div>

                    <div className="applicant-job-meta">
                      <span className="candidate-chip candidate-chip--muted">
                        {getJobPostingCategoryLabel(submission.industry_category)}
                      </span>
                      {submission.location ? (
                        <span className="candidate-chip candidate-chip--muted">{submission.location}</span>
                      ) : null}
                    </div>

                    <div className="applicant-tracker-grid">
                      <article className="applicant-tracker-stat">
                        <span>Submitted</span>
                        <strong>{new Date(submission.submitted_at).toLocaleDateString()}</strong>
                      </article>
                      <article className="applicant-tracker-stat">
                        <span>Processing</span>
                        <strong>{formatProcessingStatus(submission.status)}</strong>
                      </article>
                      <article className="applicant-tracker-stat">
                        <span>Contact</span>
                        <strong>{submission.contact_requested ? "Requested by HR" : "Blind review active"}</strong>
                      </article>
                    </div>
                  </article>
                ))}
                {!submissions.length ? <p className="feedback">No submissions yet.</p> : null}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </Shell>
  );
}
