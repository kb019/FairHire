import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { Shell } from "../components/Shell";

interface CandidateListItem {
  id: string;
  anonymous_id: string;
  review_status: string;
  submitted_at: string;
  contact_revealed: boolean;
  skills: string[];
  experience_count: number;
}

interface CandidateDetail {
  id: string;
  anonymous_id: string;
  review_status: string;
  submitted_at: string;
  fit_snapshot: {
    score: number;
    experience_alignment: "strong" | "moderate" | "limited";
    fit_summary: string;
    matched_skills: string[];
    missing_requirements: string[];
    standout_signals: string[];
  };
  redacted_content: {
    summary: string;
    skills: string[];
    certifications: string[];
    experience: Array<{
      title: string;
      company: string;
      duration_months: number | null;
      description: string;
    }>;
    education: Array<{
      degree: string;
      institution: string;
    }>;
  };
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

function getAlignmentTone(value: "strong" | "moderate" | "limited") {
  if (value === "strong") {
    return "good";
  }

  if (value === "limited") {
    return "bad";
  }

  return "neutral";
}

function formatExperienceAlignment(value: "strong" | "moderate" | "limited") {
  if (value === "strong") {
    return "Strong";
  }

  if (value === "limited") {
    return "Limited";
  }

  return "Moderate";
}

export function CandidateReviewPage() {
  const { jobPostingId } = useParams();
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateDetail | null>(null);
  const [contactInfo, setContactInfo] = useState<Record<string, { email: string; phone: string | null }>>({});
  const [error, setError] = useState("");
  const [busyCandidateId, setBusyCandidateId] = useState("");

  async function loadCandidates() {
    try {
      const response = await api.get(`/job-postings/${jobPostingId}/candidates`);
      setCandidates(response.data);
    } catch (loadError: any) {
      setError(loadError.response?.data?.error ?? "Could not load candidates.");
    }
  }

  useEffect(() => {
    void loadCandidates();
  }, [jobPostingId]);

  async function loadCandidateDetail(anonymousId: string) {
    setBusyCandidateId(anonymousId);

    try {
      const response = await api.get(`/job-postings/${jobPostingId}/candidates/${encodeURIComponent(anonymousId)}`);
      setSelectedCandidate(response.data);
      setError("");
    } catch (loadError: any) {
      setError(loadError.response?.data?.error ?? "Could not load candidate detail.");
    } finally {
      setBusyCandidateId("");
    }
  }

  async function updateStatus(anonymousId: string, status: string) {
    setBusyCandidateId(anonymousId);

    try {
      await api.put(`/job-postings/${jobPostingId}/candidates/${encodeURIComponent(anonymousId)}/status`, {
        status,
      });
      await loadCandidates();

      if (selectedCandidate?.anonymous_id === anonymousId) {
        await loadCandidateDetail(anonymousId);
      }
    } catch (updateError: any) {
      setError(updateError.response?.data?.error ?? "Could not update candidate status.");
    } finally {
      setBusyCandidateId("");
    }
  }

  async function requestContact(anonymousId: string) {
    setBusyCandidateId(anonymousId);

    try {
      const response = await api.post(
        `/job-postings/${jobPostingId}/candidates/${encodeURIComponent(anonymousId)}/request-contact`
      );
      setContactInfo((current) => ({ ...current, [anonymousId]: response.data }));
      await loadCandidates();
    } catch (contactError: any) {
      setError(contactError.response?.data?.error ?? "Could not reveal contact info.");
    } finally {
      setBusyCandidateId("");
    }
  }

  return (
    <Shell
      title="Anonymous candidate review"
      eyebrow="Candidate evaluation"
      description="Review fit, skills, experience, and redacted resume details before deciding whether to reveal contact information."
    >
      <section className="candidate-review-shell">
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="candidate-review-grid">
          <section className="panel candidate-list-panel">
            <div className="candidate-list-panel__header">
              <div>
                <span className="section-kicker">Review queue</span>
                <h2>Candidates</h2>
              </div>
              <div className="candidate-list-summary">
                <span>{candidates.length} total</span>
              </div>
            </div>
            <div className="candidate-list">
              {candidates.map((candidate) => {
                const isSelected = selectedCandidate?.anonymous_id === candidate.anonymous_id;
                const statusTone = getStatusTone(candidate.review_status);
                const revealedContact = contactInfo[candidate.anonymous_id];

                return (
                  <article
                    className={isSelected ? "candidate-card candidate-card--selected" : "candidate-card"}
                    key={candidate.id}
                  >
                    <div className="candidate-card__top">
                      <div>
                        <strong>{candidate.anonymous_id}</strong>
                        <p>{new Date(candidate.submitted_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`status-pill status-pill--${statusTone}`}>
                        {formatReviewStatus(candidate.review_status)}
                      </span>
                    </div>

                    <div className="candidate-card__meta">
                      <span>{candidate.experience_count} experience entries</span>
                      <span>{candidate.contact_revealed ? "Contact revealed" : "Blind review active"}</span>
                    </div>

                    <div className="candidate-chip-list candidate-chip-list--compact">
                      {(candidate.skills ?? []).slice(0, 5).map((skill) => (
                        <span className="candidate-chip" key={`${candidate.id}-${skill}`}>
                          {skill}
                        </span>
                      ))}
                      {!candidate.skills?.length ? <span className="candidate-chip candidate-chip--muted">No skills listed</span> : null}
                    </div>

                    <div className="candidate-card__actions">
                      <button
                        className={isSelected ? "button" : "button button--ghost"}
                        disabled={busyCandidateId === candidate.anonymous_id}
                        onClick={() => void loadCandidateDetail(candidate.anonymous_id)}
                        type="button"
                      >
                        {busyCandidateId === candidate.anonymous_id && !isSelected ? "Loading..." : "View profile"}
                      </button>
                      <button
                        className="button button--ghost"
                        disabled={busyCandidateId === candidate.anonymous_id}
                        onClick={() => void updateStatus(candidate.anonymous_id, "shortlisted")}
                        type="button"
                      >
                        Shortlist
                      </button>
                      <button
                        className="button button--ghost"
                        disabled={busyCandidateId === candidate.anonymous_id}
                        onClick={() => void updateStatus(candidate.anonymous_id, "rejected")}
                        type="button"
                      >
                        Reject
                      </button>
                    </div>

                    <div className="candidate-card__contact">
                      {revealedContact ? (
                        <div className="contact-reveal">
                          <strong>Contact</strong>
                          <p>{revealedContact.email}</p>
                          <p>{revealedContact.phone ?? "No phone"}</p>
                        </div>
                      ) : (
                        <button
                          className="button"
                          disabled={busyCandidateId === candidate.anonymous_id}
                          onClick={() => void requestContact(candidate.anonymous_id)}
                          type="button"
                        >
                          Reveal contact
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}

              {!candidates.length ? (
                <div className="empty-review-state">
                  <strong>No candidates yet.</strong>
                  <p>Applicants will appear here after resumes are submitted and processed.</p>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="panel candidate-profile-panel">
            {selectedCandidate ? (
              <>
                <div className="candidate-profile-hero">
                  <div>
                    <span className="section-kicker">Candidate profile</span>
                    <h2>{selectedCandidate.anonymous_id}</h2>
                    <p>Submitted {new Date(selectedCandidate.submitted_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`status-pill status-pill--${getStatusTone(selectedCandidate.review_status)}`}>
                    {formatReviewStatus(selectedCandidate.review_status)}
                  </span>
                </div>

                <div className="candidate-overview-grid">
                  <article className="candidate-overview-card">
                    <span>Fit score</span>
                    <strong>{selectedCandidate.fit_snapshot.score}</strong>
                  </article>
                  <article className="candidate-overview-card">
                    <span>Skills</span>
                    <strong>{selectedCandidate.redacted_content.skills.length}</strong>
                  </article>
                  <article className="candidate-overview-card">
                    <span>Experience</span>
                    <strong>{selectedCandidate.redacted_content.experience.length}</strong>
                  </article>
                  <article className="candidate-overview-card">
                    <span>Education</span>
                    <strong>{selectedCandidate.redacted_content.education.length}</strong>
                  </article>
                  <article className="candidate-overview-card">
                    <span>Certifications</span>
                    <strong>{selectedCandidate.redacted_content.certifications.length}</strong>
                  </article>
                </div>

                <section className="candidate-section-card candidate-section-card--fit">
                  <div className="candidate-section-card__header">
                    <div>
                      <h3>Fit snapshot</h3>
                      <p>{selectedCandidate.fit_snapshot.fit_summary}</p>
                    </div>
                    <span
                      className={`status-pill status-pill--${getAlignmentTone(
                        selectedCandidate.fit_snapshot.experience_alignment
                      )}`}
                    >
                      {formatExperienceAlignment(selectedCandidate.fit_snapshot.experience_alignment)} alignment
                    </span>
                  </div>

                  <div className="candidate-fit-grid">
                    <article className="candidate-fit-card">
                      <span>Matched skills</span>
                      <div className="candidate-chip-list">
                        {selectedCandidate.fit_snapshot.matched_skills.length ? (
                          selectedCandidate.fit_snapshot.matched_skills.map((skill) => (
                            <span className="candidate-chip" key={skill}>
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="candidate-chip candidate-chip--muted">No direct matches identified</span>
                        )}
                      </div>
                    </article>

                    <article className="candidate-fit-card">
                      <span>Missing requirements</span>
                      <div className="candidate-chip-list">
                        {selectedCandidate.fit_snapshot.missing_requirements.length ? (
                          selectedCandidate.fit_snapshot.missing_requirements.map((item) => (
                            <span className="candidate-chip candidate-chip--muted" key={item}>
                              {item}
                            </span>
                          ))
                        ) : (
                          <span className="candidate-chip candidate-chip--muted">No clear gaps identified</span>
                        )}
                      </div>
                    </article>
                  </div>

                  <div className="candidate-fit-signals">
                    <span>Standout signals</span>
                    <ul className="candidate-fit-list">
                      {selectedCandidate.fit_snapshot.standout_signals.length ? (
                        selectedCandidate.fit_snapshot.standout_signals.map((item) => <li key={item}>{item}</li>)
                      ) : (
                        <li>No standout signals captured.</li>
                      )}
                    </ul>
                  </div>
                </section>

                <section className="candidate-section-card">
                  <div className="candidate-section-card__header">
                    <h3>Professional summary</h3>
                  </div>
                  <p>{selectedCandidate.redacted_content.summary || "No summary provided."}</p>
                </section>

                <section className="candidate-section-card">
                  <div className="candidate-section-card__header">
                    <h3>Skills</h3>
                  </div>
                  <div className="candidate-chip-list">
                    {selectedCandidate.redacted_content.skills.length ? (
                      selectedCandidate.redacted_content.skills.map((skill) => (
                        <span className="candidate-chip" key={skill}>
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="candidate-chip candidate-chip--muted">No skills captured</span>
                    )}
                  </div>
                </section>

                <section className="candidate-section-card">
                  <div className="candidate-section-card__header">
                    <h3>Experience</h3>
                  </div>
                  <div className="candidate-profile-stack">
                    {selectedCandidate.redacted_content.experience.length ? (
                      selectedCandidate.redacted_content.experience.map((item, index) => (
                        <article className="candidate-timeline-card" key={`${item.title}-${index}`}>
                          <div className="candidate-timeline-card__top">
                            <div>
                              <strong>{item.title || "Experience entry"}</strong>
                              <p>{item.company || "Company withheld"}</p>
                            </div>
                            <span>{item.duration_months ? `${item.duration_months} months` : "Duration not stated"}</span>
                          </div>
                          <p>{item.description || "No description provided."}</p>
                        </article>
                      ))
                    ) : (
                      <p className="feedback">No experience captured.</p>
                    )}
                  </div>
                </section>

                <section className="candidate-section-card">
                  <div className="candidate-section-card__header">
                    <h3>Education</h3>
                  </div>
                  <div className="candidate-profile-stack">
                    {selectedCandidate.redacted_content.education.length ? (
                      selectedCandidate.redacted_content.education.map((item, index) => (
                        <article className="candidate-timeline-card" key={`${item.degree}-${index}`}>
                          <div className="candidate-timeline-card__top">
                            <div>
                              <strong>{item.degree || "Education entry"}</strong>
                              <p>{item.institution || "Institution withheld"}</p>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <p className="feedback">No education captured.</p>
                    )}
                  </div>
                </section>

                <section className="candidate-section-card">
                  <div className="candidate-section-card__header">
                    <h3>Certifications</h3>
                  </div>
                  <div className="candidate-chip-list">
                    {selectedCandidate.redacted_content.certifications.length ? (
                      selectedCandidate.redacted_content.certifications.map((item) => (
                        <span className="candidate-chip" key={item}>
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="candidate-chip candidate-chip--muted">No certifications captured</span>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <div className="candidate-profile-empty">
                <span className="section-kicker">Candidate profile</span>
                <h2>Select a candidate</h2>
                <p>Pick a profile from the left to review the redacted resume, skills, experience, and education.</p>
              </div>
            )}
          </aside>
        </div>
      </section>
    </Shell>
  );
}
