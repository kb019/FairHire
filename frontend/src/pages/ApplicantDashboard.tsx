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

export function ApplicantDashboardPage() {
  const [jobPostings, setJobPostings] = useState<PublicJobPosting[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
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
    <Shell title="Applicant dashboard">
      <section className="panel panel--wide">
        <div className="applicant-dashboard-layout">
          <form className="panel form-panel applicant-apply-panel" onSubmit={handleSubmit}>
            <label className="field">
              <span>Job posting</span>
              <select
                value={selectedJobPostingId}
                onChange={(event) => setSelectedJobPostingId(event.target.value)}
              >
                {jobPostings.map((posting) => (
                  <option key={posting.id} value={posting.id}>
                    {posting.title} - {getJobPostingCategoryLabel(posting.industry_category)}
                  </option>
                ))}
              </select>
            </label>
            {selectedPosting ? (
              <div className="applicant-job-meta">
                <span className="candidate-chip candidate-chip--muted">
                  {getJobPostingCategoryLabel(selectedPosting.industry_category)}
                </span>
                {selectedPosting.department ? (
                  <span className="candidate-chip candidate-chip--muted">{selectedPosting.department}</span>
                ) : null}
                {selectedPosting.location ? (
                  <span className="candidate-chip candidate-chip--muted">{selectedPosting.location}</span>
                ) : null}
                {selectedPosting.compensation_range ? (
                  <span className="candidate-chip candidate-chip--muted">{selectedPosting.compensation_range}</span>
                ) : null}
              </div>
            ) : null}
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
            <button className="button" disabled={busy} type="submit">
              {busy ? "Submitting..." : "Submit resume"}
            </button>
          </form>
          <aside className="score-panel applicant-dashboard-stack">
            <section className="panel applicant-posting-panel">
              {selectedPosting ? (
                <>
                  <div className="applicant-posting-hero">
                    <div className="applicant-posting-hero__copy">
                      <span className="section-kicker">Posting details</span>
                      <h2>{selectedPosting.title}</h2>
                      <div className="applicant-job-meta applicant-job-meta--hero">
                        <span className="candidate-chip candidate-chip--muted">
                          {getJobPostingCategoryLabel(selectedPosting.industry_category)}
                        </span>
                        {selectedPosting.employment_type ? (
                          <span className="candidate-chip candidate-chip--muted">{selectedPosting.employment_type}</span>
                        ) : null}
                        {selectedPosting.department ? (
                          <span className="candidate-chip candidate-chip--muted">{selectedPosting.department}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="applicant-detail-grid">
                    <article className="applicant-detail-row">
                      <span>Role name</span>
                      <strong>{selectedPosting.title}</strong>
                    </article>
                    <article className="applicant-detail-row">
                      <span>Department</span>
                      <strong>{selectedPosting.department || "Not listed"}</strong>
                    </article>
                    <article className="applicant-detail-row">
                      <span>Location</span>
                      <strong>{selectedPosting.location || "Not listed"}</strong>
                    </article>
                    <article className="applicant-detail-row">
                      <span>Compensation</span>
                      <strong>{selectedPosting.compensation_range || "Not listed"}</strong>
                    </article>
                    <article className="applicant-detail-row">
                      <span>Employment type</span>
                      <strong>{selectedPosting.employment_type || "Not listed"}</strong>
                    </article>
                    <article className="applicant-detail-row">
                      <span>Category</span>
                      <strong>{getJobPostingCategoryLabel(selectedPosting.industry_category)}</strong>
                    </article>
                  </div>

                  <section className="applicant-description-card">
                    <div className="applicant-section-header">
                      <h3>Job description</h3>
                    </div>
                    <p className="applicant-description-text">{selectedPosting.content || "No description available."}</p>
                  </section>
                </>
              ) : (
                <div className="applicant-posting-empty">
                  <span className="section-kicker">Posting details</span>
                  <h2>Select a job posting</h2>
                  <p>Choose a role from the form to review the description, department, location, and compensation before you apply.</p>
                </div>
              )}
            </section>

            <section className="panel applicant-submissions-panel">
              <div className="applicant-section-header">
                <h2>Your submissions</h2>
              </div>
              <div className="list">
                {submissions.map((submission) => (
                  <article className="list-item" key={submission.id}>
                    <div>
                      <strong>{submission.title}</strong>
                      <p>
                        {submission.anonymous_id} | {submission.review_status}
                      </p>
                    </div>
                    <span>{new Date(submission.submitted_at).toLocaleDateString()}</span>
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
