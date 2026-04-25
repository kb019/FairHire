import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { Shell } from "../components/Shell";

export function CandidateReviewPage() {
  const { jobPostingId } = useParams();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [contactInfo, setContactInfo] = useState<Record<string, { email: string; phone: string | null }>>({});
  const [error, setError] = useState("");

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
    const response = await api.get(`/job-postings/${jobPostingId}/candidates/${encodeURIComponent(anonymousId)}`);
    setSelectedCandidate(response.data);
  }

  async function updateStatus(anonymousId: string, status: string) {
    await api.put(`/job-postings/${jobPostingId}/candidates/${encodeURIComponent(anonymousId)}/status`, {
      status,
    });
    await loadCandidates();
    if (selectedCandidate?.anonymous_id === anonymousId) {
      await loadCandidateDetail(anonymousId);
    }
  }

  async function requestContact(anonymousId: string) {
    const response = await api.post(
      `/job-postings/${jobPostingId}/candidates/${encodeURIComponent(anonymousId)}/request-contact`
    );
    setContactInfo((current) => ({ ...current, [anonymousId]: response.data }));
    await loadCandidates();
  }

  return (
    <Shell title="Anonymous candidate review">
      <section className="panel panel--wide">
        {error ? <p className="feedback feedback--error">{error}</p> : null}
        <div className="editor-layout">
          <div className="list">
            {candidates.map((candidate) => (
              <article className="issue-card" key={candidate.id}>
                <strong>{candidate.anonymous_id}</strong>
                <p>Status: {candidate.review_status}</p>
                <p>Skills: {(candidate.skills ?? []).join(", ") || "N/A"}</p>
                <div className="actions actions--compact">
                  <button className="button button--ghost" onClick={() => void loadCandidateDetail(candidate.anonymous_id)} type="button">
                    View
                  </button>
                  <button className="button button--ghost" onClick={() => void updateStatus(candidate.anonymous_id, "shortlisted")} type="button">
                    Shortlist
                  </button>
                  <button className="button button--ghost" onClick={() => void updateStatus(candidate.anonymous_id, "rejected")} type="button">
                    Reject
                  </button>
                  <button className="button" onClick={() => void requestContact(candidate.anonymous_id)} type="button">
                    Request contact
                  </button>
                </div>
                {contactInfo[candidate.anonymous_id] ? (
                  <p>
                    {contactInfo[candidate.anonymous_id].email} ·{" "}
                    {contactInfo[candidate.anonymous_id].phone ?? "No phone"}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
          <aside className="panel score-panel">
            <h2>{selectedCandidate?.anonymous_id ?? "Select a candidate"}</h2>
            {selectedCandidate ? (
              <>
                <p>Review status: {selectedCandidate.review_status}</p>
                <div className="subpanel">
                  <h3>Summary</h3>
                  <p>{selectedCandidate.redacted_content.summary || "No summary provided."}</p>
                </div>
                <div className="subpanel">
                  <h3>Skills</h3>
                  <p>{(selectedCandidate.redacted_content.skills ?? []).join(", ") || "N/A"}</p>
                </div>
                <div className="subpanel">
                  <h3>Experience</h3>
                  <div className="list">
                    {(selectedCandidate.redacted_content.experience ?? []).map((item: any, index: number) => (
                      <article className="list-item" key={`${item.title}-${index}`}>
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.company}</p>
                        </div>
                        <span>{item.duration_months ?? "N/A"} months</span>
                      </article>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="feedback">Choose a candidate to inspect the redacted resume.</p>
            )}
          </aside>
        </div>
      </section>
    </Shell>
  );
}
