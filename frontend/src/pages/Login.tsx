import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { api, setStoredAuth } from "../api/client";
import { Shell } from "../components/Shell";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await api.post("/auth/login", { email, password });
      setStoredAuth(response.data.token, response.data.userType);
      navigate(response.data.userType === "hr" ? "/hr" : "/applicant");
    } catch (submissionError: any) {
      setError(submissionError.response?.data?.error ?? "Login failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Sign in">
      <section className="auth-shell">
        <aside className="auth-showcase">
          <div className="auth-showcase__hero">
            <span className="section-kicker">Recruiting platform</span>
            <h2>Access the same job application workspace used for role review, resume intake, and hiring decisions.</h2>
            <p>Sign in once and continue where you left off, whether you are managing postings or applying to roles.</p>
          </div>
          <div className="auth-showcase__grid">
            <article className="auth-showcase__item">
              <span className="card__label">HR teams</span>
              <strong>Manage postings and candidate review</strong>
              <p>Monitor posting quality, review blind profiles, and reveal contact only when appropriate.</p>
            </article>
            <article className="auth-showcase__item">
              <span className="card__label">Applicants</span>
              <strong>Apply and track status in one place</strong>
              <p>Browse openings, upload your resume, and follow the application process without re-entering data.</p>
            </article>
          </div>
        </aside>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-card__header">
            <span className="section-kicker">Account access</span>
            <h2>Sign in</h2>
            <p>Use the account you already created for HR or applicant access.</p>
          </div>
          <div className="auth-card__chips">
            <span className="job-pill">HR users</span>
            <span className="job-pill">Applicants</span>
          </div>
          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
            />
          </label>
          {error ? <p className="feedback feedback--error">{error}</p> : null}
          <button className="button" disabled={busy} type="submit">
            {busy ? "Signing in..." : "Sign in"}
          </button>
          <p className="feedback auth-card__footer">
            Need an account? <Link to="/register/hr">Create HR access</Link> or{" "}
            <Link to="/register/applicant">register as an applicant</Link>.
          </p>
        </form>
      </section>
    </Shell>
  );
}
