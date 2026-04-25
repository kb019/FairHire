import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";

export function HomePage() {
  return (
    <Shell title="Fairer hiring, enforced in the product">
      <section className="panel panel--wide landing-shell">
        <div className="landing-hero">
          <div className="landing-hero__copy">
            <span className="section-kicker">Product overview</span>
            <h2>One recruiting workspace for fair job design, blind screening, and accountable review.</h2>
            <p>
              The platform helps HR teams publish cleaner job postings, applicants apply through a
              transparent experience, and candidate review stays anonymized until there is a deliberate
              decision to reveal contact details.
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
            <span className="card__label">Phase 1</span>
            <h3>Job posting ethics check</h3>
            <p>
              HR gets immediate feedback on biased language, exclusionary requirements, compensation
              clarity, and inclusive language before a role goes live.
            </p>
          </article>
          <article className="feature-card">
            <span className="card__label">Phase 2</span>
            <h3>Blind resume intake</h3>
            <p>
              Applicants submit once. The system parses the resume, redacts sensitive identity signals,
              and stores a structured review-ready profile.
            </p>
          </article>
          <article className="feature-card">
            <span className="card__label">Phase 3</span>
            <h3>Anonymous candidate review</h3>
            <p>
              Hiring teams review fit, experience, and qualifications in a consistent interface without
              seeing institution prestige or personal identifiers.
            </p>
          </article>
        </div>
      </section>
    </Shell>
  );
}
