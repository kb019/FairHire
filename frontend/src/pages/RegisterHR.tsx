import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Shell } from "../components/Shell";

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function RegisterHRPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!passwordRule.test(password)) {
      setError("Password must be at least 8 characters and include uppercase, lowercase, and a number.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords must match.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await api.post("/auth/register/hr", { email, password });
      navigate("/login");
    } catch (submissionError: any) {
      const message = submissionError.response?.data?.errors?.[0] ?? submissionError.response?.data?.error;
      setError(message ?? "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Create HR account">
      <section className="auth-shell">
        <aside className="auth-showcase">
          <div className="auth-showcase__hero">
            <span className="section-kicker">HR onboarding</span>
            <h2>Set up the hiring-side workspace for compliant job authoring and structured anonymous review.</h2>
            <p>Your HR account becomes the control point for postings, ethics reporting, and candidate evaluation.</p>
          </div>
          <div className="auth-showcase__grid">
            <article className="auth-showcase__item">
              <span className="card__label">Before publishing</span>
              <strong>Live job posting review</strong>
              <p>Draft roles with compliance scoring, issue detection, and category-aware posting structure.</p>
            </article>
            <article className="auth-showcase__item">
              <span className="card__label">After applications</span>
              <strong>Anonymous candidate workflow</strong>
              <p>Review skills and experience first, then deliberately request contact details when needed.</p>
            </article>
          </div>
        </aside>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-card__header">
            <span className="section-kicker">Create access</span>
            <h2>Create HR account</h2>
            <p>Use your work email so dashboards, posting ownership, and reporting stay tied to the right team.</p>
          </div>
          <div className="auth-card__chips">
            <span className="job-pill">Posting management</span>
            <span className="job-pill">Candidate review</span>
          </div>
          <label className="field">
            <span>Work email</span>
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
          <label className="field">
            <span>Confirm password</span>
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
            />
          </label>
          {error ? <p className="feedback feedback--error">{error}</p> : null}
          <button className="button" disabled={busy} type="submit">
            {busy ? "Creating account..." : "Create account"}
          </button>
          <p className="feedback auth-card__footer">
            Already registered? <Link to="/login">Sign in</Link>.
          </p>
        </form>
      </section>
    </Shell>
  );
}
