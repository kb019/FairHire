import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { Shell } from "../components/Shell";

interface Issue {
  id: string;
  type: string;
  severity: "critical" | "warning" | "suggestion";
  flagged_text: string;
  explanation: string;
  suggestion: string;
  acknowledged: boolean;
  acknowledgement_note: string | null;
}

const initialForm = {
  title: "",
  department: "",
  location: "",
  employmentType: "full-time",
  compensationRange: "",
  content: "",
  status: "draft",
};

export function JobPostingEditorPage() {
  const [form, setForm] = useState(initialForm);
  const [score, setScore] = useState(100);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [savedPostingId, setSavedPostingId] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!form.content.trim()) {
      setScore(100);
      setIssues([]);
      setAnalysisError("");
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await api.post("/analyze/job-posting", {
          text: form.content,
        });
        setScore(response.data.score);
        setIssues(response.data.issues);
        setAnalysisError("");
      } catch (error: any) {
        setAnalysisError(error.response?.data?.error ?? "Live analysis unavailable.");
      }
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [form.content]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const response = await api.post("/job-postings", form);
      setSavedPostingId(response.data.id);
      setIssues(response.data.issues);
      setScore(response.data.score);
      setSaveMessage(`Job posting saved with compliance score ${response.data.score}.`);
    } catch (error: any) {
      setSaveError(error.response?.data?.error ?? "Could not save job posting.");
    } finally {
      setBusy(false);
    }
  }

  async function acknowledgeIssue(issueId: string) {
    if (!savedPostingId) {
      return;
    }

    const justification = window.prompt("Enter a justification for acknowledging this issue.");

    if (!justification?.trim()) {
      return;
    }

    try {
      const response = await api.put(
        `/job-postings/${savedPostingId}/report/issues/${issueId}/acknowledge`,
        { justification }
      );
      setIssues(response.data.issues);
      setScore(response.data.score);
      setSaveMessage(`Issue acknowledged. Updated compliance score ${response.data.score}.`);
    } catch (error: any) {
      setSaveError(error.response?.data?.error ?? "Could not acknowledge issue.");
    }
  }

  return (
    <Shell title="Create job posting">
      <div className="editor-layout">
        <form className="panel form-panel" onSubmit={handleSubmit}>
          <label className="field">
            <span>Job title</span>
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              type="text"
            />
          </label>
          <label className="field">
            <span>Department</span>
            <input
              value={form.department}
              onChange={(event) =>
                setForm((current) => ({ ...current, department: event.target.value }))
              }
              type="text"
            />
          </label>
          <label className="field">
            <span>Location</span>
            <input
              value={form.location}
              onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
              type="text"
            />
          </label>
          <label className="field">
            <span>Employment type</span>
            <select
              value={form.employmentType}
              onChange={(event) =>
                setForm((current) => ({ ...current, employmentType: event.target.value }))
              }
            >
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </label>
          <label className="field">
            <span>Compensation range</span>
            <input
              value={form.compensationRange}
              onChange={(event) =>
                setForm((current) => ({ ...current, compensationRange: event.target.value }))
              }
              type="text"
            />
          </label>
          <label className="field">
            <span>Job description</span>
            <textarea
              rows={14}
              value={form.content}
              onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
            />
          </label>
          {saveMessage ? <p className="feedback feedback--success">{saveMessage}</p> : null}
          {saveError ? <p className="feedback feedback--error">{saveError}</p> : null}
          <button className="button" disabled={busy} type="submit">
            {busy ? "Saving..." : "Save posting"}
          </button>
        </form>
        <aside className="panel score-panel">
          <div className={`score-badge score-badge--${score >= 80 ? "good" : score >= 50 ? "warn" : "bad"}`}>
            <span>Compliance score</span>
            <strong>{score}</strong>
          </div>
          {analysisError ? <p className="feedback feedback--error">{analysisError}</p> : null}
          <div className="issue-list">
            {issues.map((issue) => (
              <article className="issue-card" key={issue.id}>
                <p className={`issue-card__severity issue-card__severity--${issue.severity}`}>
                  {issue.severity}
                </p>
                <h2>{issue.type.split("_").join(" ")}</h2>
                <p>{issue.flagged_text ? `Flagged: "${issue.flagged_text}"` : "Missing element detected"}</p>
                <p>{issue.explanation}</p>
                <p>{issue.suggestion}</p>
                {savedPostingId && !issue.acknowledged ? (
                  <div className="actions actions--compact">
                    <button
                      className="button button--ghost"
                      onClick={() => void acknowledgeIssue(issue.id)}
                      type="button"
                    >
                      Acknowledge intentionally
                    </button>
                  </div>
                ) : null}
                {issue.acknowledged ? (
                  <p className="feedback">Acknowledged: {issue.acknowledgement_note}</p>
                ) : null}
              </article>
            ))}
            {!issues.length && !analysisError ? (
              <p className="feedback">No issues detected yet.</p>
            ) : null}
          </div>
        </aside>
      </div>
    </Shell>
  );
}
