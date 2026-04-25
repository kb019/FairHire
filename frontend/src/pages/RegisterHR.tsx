import { FormEvent, useState } from "react";
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
      <form className="panel form-panel" onSubmit={handleSubmit}>
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
      </form>
    </Shell>
  );
}

