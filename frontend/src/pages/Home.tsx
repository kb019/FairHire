import { Link } from "react-router-dom";
import { Shell } from "../components/Shell";

export function HomePage() {
  return (
    <Shell title="Fairer hiring, enforced in the product">
      <section className="panel panel--wide">
        <div className="grid">
          <article className="card">
            <span className="card__label">Phase 1</span>
            <h2>Job posting ethics check</h2>
            <p>
              HR gets immediate feedback on biased language, exclusionary requirements, and missing
              inclusive statements.
            </p>
          </article>
          <article className="card">
            <span className="card__label">Phase 2</span>
            <h2>Blind resume intake</h2>
            <p>
              Applicants submit their resumes once. The system handles identity redaction
              automatically before review.
            </p>
          </article>
          <article className="card">
            <span className="card__label">Phase 3</span>
            <h2>Anonymous candidate review</h2>
            <p>
              HR sees only merit signals until a candidate is advanced and contact details are
              explicitly requested.
            </p>
          </article>
        </div>
        <div className="actions">
          <Link className="button" to="/register/hr">
            Start as HR
          </Link>
          <Link className="button button--ghost" to="/register/applicant">
            Start as applicant
          </Link>
        </div>
      </section>
    </Shell>
  );
}

