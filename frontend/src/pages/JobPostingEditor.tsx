import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { Shell } from "../components/Shell";
import { getJobPostingCategoryLabel, jobPostingCategories } from "../constants/jobPostingCategories";

interface Issue {
  id: string;
  type: string;
  severity: "critical" | "warning" | "suggestion";
  text_offset_start: number;
  text_offset_end: number;
  flagged_text: string;
  explanation: string;
  suggestion: string;
  educational_link: string;
  acknowledged: boolean;
  acknowledgement_note: string | null;
}

const initialForm = {
  title: "",
  industryCategory: "general_business",
  department: "",
  location: "",
  employmentType: "full-time",
  compensationRange: "",
  content: "",
  status: "draft",
};

const descriptionPrompts = [
  "Open with the mission and business impact of the role.",
  "List the work candidates will actually own in their first 6 to 12 months.",
  "Describe must-have skills separately from nice-to-have experience.",
  "Close with an inclusive hiring or equal opportunity statement.",
];

function getScoreTone(score: number) {
  if (score >= 80) {
    return "good";
  }

  if (score >= 50) {
    return "warn";
  }

  return "bad";
}

function formatIssueType(type: string) {
  return type.split("_").join(" ");
}

function findIssueRange(content: string, issue: Issue) {
  if (!issue.flagged_text) {
    return null;
  }

  const offsetStart = Math.max(0, issue.text_offset_start ?? 0);
  const offsetEnd = Math.max(offsetStart, issue.text_offset_end ?? offsetStart);
  const currentSlice = content.slice(offsetStart, offsetEnd);

  if (currentSlice.toLowerCase() === issue.flagged_text.toLowerCase()) {
    return { start: offsetStart, end: offsetEnd };
  }

  const fallbackIndex = content.toLowerCase().indexOf(issue.flagged_text.toLowerCase());

  if (fallbackIndex >= 0) {
    return {
      start: fallbackIndex,
      end: fallbackIndex + issue.flagged_text.length,
    };
  }

  return null;
}

function cleanupEditedContent(value: string) {
  return value
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n");
}

function getQuickReplacement(issue: Issue) {
  const flagged = issue.flagged_text.trim().toLowerCase();

  if (issue.type === "gendered_language") {
    const map: Record<string, string> = {
      rockstar: "specialist",
      ninja: "expert",
      manpower: "team capacity",
      dominant: "strong",
      "competitive warrior": "collaborative professional",
    };

    return map[flagged] ?? "qualified professional";
  }

  if (issue.type === "age_language") {
    const map: Record<string, string> = {
      "recent graduate": "early-career candidate",
      "digital native": "comfortable with digital tools",
      young: "motivated",
      "energetic team": "collaborative team",
    };

    return map[flagged] ?? "qualified candidate";
  }

  if (issue.type === "cultural_exclusion") {
    const map: Record<string, string> = {
      "native english speaker": "strong written and verbal communication skills",
      "cultural fit": "ability to collaborate across teams",
      "american-born": "authorized to work in the required location",
    };

    return map[flagged] ?? "clear role-relevant collaboration requirements";
  }

  if (issue.type === "disability_exclusion") {
    return "able to perform the essential functions of the role with or without reasonable accommodation";
  }

  if (issue.type === "missing_eeo") {
    return "We are an equal opportunity employer and welcome applicants from all backgrounds.";
  }

  if (issue.type === "exclusionary_requirement") {
    const technologyMatch = issue.flagged_text.match(/(?:with|in)\s+([A-Za-z0-9.+#-]+)/i);
    const technology = technologyMatch?.[1];

    return technology
      ? `Demonstrated experience with ${technology} in production environments`
      : "Demonstrated experience relevant to the tools and responsibilities in this role";
  }

  if (issue.type === "compensation_opacity") {
    return "Include a clear compensation range for the role.";
  }

  if (issue.type === "credential_inflation") {
    return "Equivalent practical experience will also be considered.";
  }

  return "";
}

function getSuggestedRewrite(issue: Issue) {
  return (
    getQuickReplacement(issue) ||
    issue.suggestion ||
    "Rewrite this language in a more inclusive and job-relevant way."
  );
}

export function JobPostingEditorPage() {
  const [form, setForm] = useState(initialForm);
  const [score, setScore] = useState(100);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dismissedSuggestionIds, setDismissedSuggestionIds] = useState<string[]>([]);
  const [savedPostingId, setSavedPostingId] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const scoreTone = getScoreTone(score);
  const issueCounts = issues.reduce(
    (totals, issue) => {
      totals[issue.severity] += 1;
      return totals;
    },
    { critical: 0, warning: 0, suggestion: 0 }
  );
  const wordCount = form.content.trim() ? form.content.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (!form.content.trim()) {
      setScore(100);
      setIssues([]);
      setIsAnalyzing(false);
      setDismissedSuggestionIds([]);
      setAnalysisError("");
      return;
    }

    setIsAnalyzing(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.post("/analyze/job-posting", {
          text: form.content,
        });
        setScore(response.data.score);
        setIssues(response.data.issues);
        setDismissedSuggestionIds([]);
        setAnalysisError("");
      } catch (error: any) {
        setAnalysisError(error.response?.data?.error ?? "Live analysis unavailable.");
      } finally {
        setIsAnalyzing(false);
      }
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
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
      setDismissedSuggestionIds([]);
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
      setDismissedSuggestionIds([]);
      setScore(response.data.score);
      setSaveMessage(`Issue acknowledged. Updated compliance score ${response.data.score}.`);
    } catch (error: any) {
      setSaveError(error.response?.data?.error ?? "Could not acknowledge issue.");
    }
  }

  function applyContentUpdate(nextContent: string, selectionStart?: number, selectionEnd?: number) {
    setForm((current) => ({ ...current, content: nextContent }));
    setSaveError("");
    setAnalysisError("");
    setSaveMessage("Draft updated. Bias analysis will refresh automatically.");

    if (typeof selectionStart === "number") {
      requestAnimationFrame(() => {
        const textarea = descriptionRef.current;

        if (!textarea) {
          return;
        }

        textarea.focus();
        textarea.setSelectionRange(selectionStart, selectionEnd ?? selectionStart);
      });
    }
  }

  function acceptIssueSuggestion(issue: Issue) {
    const replacement = getSuggestedRewrite(issue);

    if (!issue.flagged_text) {
      const nextContent = `${form.content.trim()}\n\n${replacement}`.trim();
      applyContentUpdate(nextContent, nextContent.length, nextContent.length);
      return;
    }

    const range = findIssueRange(form.content, issue);

    if (!range) {
      setSaveError("Could not find the flagged text in the current draft.");
      return;
    }

    const nextContent = `${form.content.slice(0, range.start)}${replacement}${form.content.slice(range.end)}`;
    applyContentUpdate(nextContent, range.start, range.start + replacement.length);
  }

  function modifyIssueText(issue: Issue) {
    const initialValue = getSuggestedRewrite(issue) || issue.flagged_text || "";
    const replacement = window.prompt("Edit the replacement text for this issue.", initialValue)?.trim();

    if (!replacement) {
      return;
    }

    if (!issue.flagged_text) {
      const nextContent = `${form.content.trim()}\n\n${replacement}`.trim();
      applyContentUpdate(nextContent, nextContent.length, nextContent.length);
      return;
    }

    const range = findIssueRange(form.content, issue);

    if (!range) {
      setSaveError("Could not find the flagged text in the current draft.");
      return;
    }

    const nextContent = `${form.content.slice(0, range.start)}${replacement}${form.content.slice(range.end)}`;
    applyContentUpdate(nextContent, range.start, range.start + replacement.length);
  }

  function rejectSuggestion(issueId: string) {
    setDismissedSuggestionIds((current) => (current.includes(issueId) ? current : [...current, issueId]));
    setSaveMessage("Suggestion dismissed for this draft.");
  }

  return (
    <Shell
      title="Compose a job posting"
      eyebrow="Job authoring"
      description="Draft the role, compensation, and requirements in one workspace while the review rail updates against the posting."
    >
      <section className="editor-shell">
        <div className="editor-hero">
          <div className="editor-hero__copy">
            <span className="section-kicker">Authoring studio</span>
            <h2>Write a posting that is clear, credible, and fair before it goes live.</h2>
            <p>
              Draft the role like a real hiring brief. The review rail updates as language, requirements,
              and inclusion cues change.
            </p>
          </div>
          <div className="editor-hero__metrics">
            <div className="metric-pill">
              <span>Live score</span>
              <strong>{score}</strong>
            </div>
            <div className="metric-pill">
              <span>Open issues</span>
              <strong>{issues.length}</strong>
            </div>
            <div className="metric-pill">
              <span>Word count</span>
              <strong>{wordCount}</strong>
            </div>
          </div>
        </div>

        <div className="editor-layout editor-layout--refined">
          <form className="editor-form" onSubmit={handleSubmit}>
            <section className="panel panel--soft section-panel">
              <div className="section-panel__header">
                <div>
                  <span className="section-kicker">Role setup</span>
                  <h3>Core details</h3>
                </div>
                <p>Keep the essentials concise so candidates understand the shape of the role immediately.</p>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span>Job title</span>
                  <input
                    placeholder="Senior Product Designer"
                    value={form.title}
                    onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    type="text"
                  />
                </label>
                <label className="field">
                  <span>Industry category</span>
                  <select
                    value={form.industryCategory}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, industryCategory: event.target.value }))
                    }
                  >
                    {jobPostingCategories.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Department</span>
                  <input
                    placeholder="Design"
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
                    placeholder="Phoenix, AZ or remote"
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
                    placeholder="$120,000 - $145,000"
                    value={form.compensationRange}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, compensationRange: event.target.value }))
                    }
                    type="text"
                  />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="panel panel--soft section-panel">
              <div className="section-panel__header">
                <div>
                  <span className="section-kicker">Job narrative</span>
                  <h3>Responsibilities and requirements</h3>
                </div>
                <p>Write in plain, specific language. Avoid wish lists and vague team-fit language.</p>
              </div>
              <label className="field field--editor">
                <span>Job description</span>
                <textarea
                  ref={descriptionRef}
                  placeholder="Example: We are hiring a Senior Product Designer to lead end-to-end design for our employer workflow platform..."
                  rows={18}
                  value={form.content}
                  onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                />
              </label>
              <div className="editor-notes">
                {descriptionPrompts.map((prompt) => (
                  <div className="editor-note" key={prompt}>
                    {prompt}
                  </div>
                ))}
              </div>
            </section>

            <section className="panel panel--soft section-panel section-panel--compact">
              <div className="posting-preview">
                <div className="posting-preview__meta">
                  <span>{getJobPostingCategoryLabel(form.industryCategory)}</span>
                  <span>{form.department || "Department"}</span>
                  <span>{form.location || "Location"}</span>
                  <span>{form.employmentType}</span>
                  <span>{form.compensationRange || "Compensation range"}</span>
                </div>
                <h3>{form.title || "Untitled role"}</h3>
                <p>
                  {form.content.trim()
                    ? `${form.content.trim().slice(0, 220)}${form.content.trim().length > 220 ? "..." : ""}`
                    : "A polished summary preview appears here as you draft the posting."}
                </p>
              </div>
              <div className="form-footer">
                <div>
                  {saveMessage ? <p className="feedback feedback--success">{saveMessage}</p> : null}
                  {saveError ? <p className="feedback feedback--error">{saveError}</p> : null}
                </div>
                <button className="button" disabled={busy} type="submit">
                  {busy ? "Saving..." : "Save posting"}
                </button>
              </div>
            </section>
          </form>

          <aside className="review-rail">
            <section className="panel review-score">
              <div className={`score-badge score-badge--${scoreTone}`}>
                <span>Compliance score</span>
                <strong>{score}</strong>
                <small>
                  {score >= 80
                    ? "Strong baseline. Keep the requirements specific."
                    : score >= 50
                      ? "Usable draft, but some language still needs refinement."
                    : "This posting needs revision before it is ready for candidates."}
                </small>
              </div>
              {isAnalyzing ? (
                <div className="analysis-loading">
                  <span className="analysis-loading__spinner" aria-hidden="true" />
                  <span>Analyzing job description...</span>
                </div>
              ) : null}
              <div className="review-score__grid">
                <article className="review-stat">
                  <span>Critical</span>
                  <strong>{issueCounts.critical}</strong>
                </article>
                <article className="review-stat">
                  <span>Warnings</span>
                  <strong>{issueCounts.warning}</strong>
                </article>
                <article className="review-stat">
                  <span>Suggestions</span>
                  <strong>{issueCounts.suggestion}</strong>
                </article>
              </div>
              {analysisError ? <p className="feedback feedback--error">{analysisError}</p> : null}
            </section>

            <section className="panel review-issues">
              <div className="section-panel__header section-panel__header--tight">
                <div>
                  <span className="section-kicker">Review rail</span>
                  <h3>Detected issues</h3>
                </div>
                <p>{isAnalyzing ? "Running bias detection on the current draft." : "Each flag includes the phrase, why it matters, and what to rewrite."}</p>
              </div>
              <div className="issue-list">
                {issues.map((issue) => (
                  <article className="issue-card issue-card--refined" key={issue.id}>
                    <div className="issue-card__header">
                      <p className={`issue-card__severity issue-card__severity--${issue.severity}`}>
                        {issue.severity}
                      </p>
                      <span className="issue-card__type">{formatIssueType(issue.type)}</span>
                    </div>
                    <h2>{issue.flagged_text ? `"${issue.flagged_text}"` : "Missing inclusive element"}</h2>
                    <p>{issue.explanation}</p>
                    {!dismissedSuggestionIds.includes(issue.id) ? (
                      <>
                        <div className="issue-card__rewrite">
                          <span className="issue-card__rewrite-label">Suggested rewrite</span>
                          <p className="issue-card__suggestion">{getSuggestedRewrite(issue)}</p>
                        </div>
                        <div className="actions actions--compact">
                          <button
                            className="button"
                            onClick={() => acceptIssueSuggestion(issue)}
                            type="button"
                          >
                            Accept
                          </button>
                          <button
                            className="button button--ghost"
                            onClick={() => modifyIssueText(issue)}
                            type="button"
                          >
                            Modify
                          </button>
                          <button
                            className="button button--ghost"
                            onClick={() => rejectSuggestion(issue.id)}
                            type="button"
                          >
                            Reject
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="feedback">Suggestion dismissed for this draft.</p>
                    )}
                    {savedPostingId && !issue.acknowledged ? (
                      <div className="actions actions--compact">
                        <button
                          className="button button--ghost"
                          onClick={() => void acknowledgeIssue(issue.id)}
                          type="button"
                        >
                          Mark intentional
                        </button>
                      </div>
                    ) : null}
                    {issue.acknowledged ? (
                      <p className="feedback">Acknowledged: {issue.acknowledgement_note}</p>
                    ) : null}
                  </article>
                ))}
                {!issues.length && !analysisError ? (
                  <div className="empty-review-state">
                    <strong>No issues detected yet.</strong>
                    <p>Use the prompts on the left to add responsibilities, requirements, and inclusive language.</p>
                  </div>
                ) : null}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </Shell>
  );
}
