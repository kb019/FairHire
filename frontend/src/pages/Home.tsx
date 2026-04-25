import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";

export function HomePage() {
  return (
    <Shell
      title="Bias-aware hiring, built into the workflow"
      eyebrow="Platform overview"
      description="Design inclusive job postings, run blind resume intake, and review candidates in one consistent recruiting workspace."
    >
      <section className="panel panel--wide landing-shell">
        <div className="landing-hero">
          <div className="landing-hero__copy">
            <span className="section-kicker">Hiring product</span>
            <h2>One system for compliant posting design, structured applications, and blind candidate review.</h2>
            <p>
              HR teams draft better roles, applicants see real job details before applying, and hiring
              decisions stay anchored on qualifications rather than identity or institutional prestige.
            </p>
            <div className="actions">
              <Link className="button" to="/register/hr">
                Start as HR
              </Link>
              <Link className="button button--ghost" to="/register/applicant">
                Start as applicant
              </Link>
            </div>
          </div>
          <div className="landing-hero__stats">
            <article className="hero-stat-card">
              <span className="card__label">Before publishing</span>
              <strong>Bias checks</strong>
              <p>Catch exclusionary language, inflated requirements, and missing inclusive cues.</p>
            </article>
            <article className="hero-stat-card">
              <span className="card__label">During intake</span>
              <strong>Blind processing</strong>
              <p>Resume parsing and redaction keep non-job signals out of the first review pass.</p>
            </article>
            <article className="hero-stat-card">
              <span className="card__label">During review</span>
              <strong>Structured decisions</strong>
              <p>Shortlist, reject, and reveal contact only when the hiring team explicitly chooses to.</p>
            </article>
          </div>
        </div>

        <div className="feature-grid feature-grid--triple">
          <article className="feature-card">
            <span className="card__label">Role design</span>
            <h3>Job posting quality review</h3>
            <p>
              Publishing starts with role clarity, compensation transparency, and language review before a
              requisition reaches applicants.
            </p>
          </article>
          <article className="feature-card">
            <span className="card__label">Application flow</span>
            <h3>Blind resume intake</h3>
            <p>
              Applicants upload once, the platform parses the resume, and non-job signals are withheld from
              the first review pass.
            </p>
          </article>
          <article className="feature-card">
            <span className="card__label">Hiring decisions</span>
            <h3>Structured candidate evaluation</h3>
            <p>
              Teams compare fit, experience, and missing requirements in a consistent interface before
              choosing to reveal contact details.
            </p>
          </article>
        </div>
      </section>
    </Shell>
  );
}
