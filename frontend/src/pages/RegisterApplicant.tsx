import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { Shell } from "../components/Shell";

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function RegisterApplicantPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
      await api.post("/auth/register/applicant", { email, phone, password });
      navigate("/login");
    } catch (submissionError: any) {
      const message = submissionError.response?.data?.errors?.[0] ?? submissionError.response?.data?.error;
      setError(message ?? "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Create applicant account"
      eyebrow="Applicant onboarding"
      description="Create one account to review roles, submit your resume, and track the hiring process from the same portal."
    >
      <section className="auth-shell">
        <aside className="auth-showcase">
          <div className="auth-showcase__hero">
            <span className="section-kicker">Applicant access</span>
            <h2>Create one account to review openings, apply with your resume, and track hiring progress.</h2>
            <p>The application flow keeps job details visible and your direct contact information protected during blind review.</p>
          </div>
          <div className="auth-showcase__grid">
            <article className="auth-showcase__item">
              <span className="card__label">Before applying</span>
              <strong>Review complete job details</strong>
              <p>See role name, compensation, department, location, and description before you submit.</p>
            </article>
            <article className="auth-showcase__item">
              <span className="card__label">During review</span>
              <strong>Protected contact disclosure</strong>
              <p>Your phone and email stay hidden until a hiring team explicitly requests direct contact.</p>
            </article>
          </div>
        </aside>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-card__header">
            <span className="section-kicker">Create access</span>
            <h2>Create applicant account</h2>
            <p>Your phone stays hidden until a hiring team explicitly requests contact after review.</p>
          </div>
          <div className="auth-card__chips">
            <span className="job-pill">Resume upload</span>
            <span className="job-pill">Application tracking</span>
          </div>
          <label className="field">
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
          </label>
          <label className="field">
            <span>Phone</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" />
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
