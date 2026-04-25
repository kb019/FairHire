import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { Shell } from "../components/Shell";
import { getJobPostingCategoryLabel } from "../constants/jobPostingCategories";

interface PublicJobPosting {
  id: string;
  title: string;
  industry_category: string;
  location: string | null;
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
        <div className="editor-layout">
          <form className="panel form-panel" onSubmit={handleSubmit}>
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
              <p className="feedback">
                {getJobPostingCategoryLabel(selectedPosting.industry_category)}
                {selectedPosting.location ? ` | ${selectedPosting.location}` : ""}
              </p>
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
          <aside className="panel score-panel">
            <h2>Your submissions</h2>
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
          </aside>
        </div>
      </section>
    </Shell>
  );
}
