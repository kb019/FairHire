import { FormEvent, useState } from "react";
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
      <form className="panel form-panel" onSubmit={handleSubmit}>
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
      </form>
    </Shell>
  );
}

