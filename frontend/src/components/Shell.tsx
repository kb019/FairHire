import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { clearStoredAuth, getStoredToken, getStoredUserType } from "../api/client";

interface ShellProps {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
}

export function Shell({ title, eyebrow, description, children }: ShellProps) {
  const navigate = useNavigate();
  const token = getStoredToken();
  const userType = getStoredUserType();
  const defaultEyebrow = token
    ? userType === "hr"
      ? "HR workspace"
      : "Applicant workspace"
    : "Recruiting platform";
  const contextPill = token
    ? userType === "hr"
      ? "HR access"
      : "Applicant access"
    : "Shared access";
  const contextDetail = token
    ? "Session stays active until you choose to log out."
    : "Bias-aware posting, application, and candidate review in one product.";
  const navigation = token
    ? userType === "hr"
      ? [
          { to: "/", label: "Overview" },
          { to: "/hr", label: "Dashboard" },
          { to: "/hr/editor", label: "Editor" },
        ]
      : [
          { to: "/", label: "Overview" },
          { to: "/applicant", label: "Dashboard" },
        ]
    : [
        { to: "/", label: "Overview" },
        { to: "/login", label: "Login" },
        { to: "/register/hr", label: "HR Signup" },
        { to: "/register/applicant", label: "Applicant Signup" },
      ];

  function handleLogout() {
    clearStoredAuth();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <header className="shell-header">
        <div className="shell-header__bar">
          <Link className="shell-brand" to="/">
            <span className="shell-brand__eyebrow">Ethics Hiring Tracker</span>
            <span className="shell-brand__mark">Bias-aware recruiting workspace</span>
          </Link>
          <nav className="shell-nav">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) => (isActive ? "nav-link nav-link--active" : "nav-link")}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
            {token ? (
              <button className="nav-link nav-link--button" onClick={handleLogout} type="button">
                Logout
              </button>
            ) : null}
          </nav>
        </div>
      </header>
      <section className="shell-pagehead">
        <div className="shell-pagehead__copy">
          <span className="section-kicker">{eyebrow ?? defaultEyebrow}</span>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="shell-pagehead__meta">
          <span className="shell-pagehead__pill">{contextPill}</span>
          <p>{contextDetail}</p>
        </div>
      </section>
      <main className="page">{children}</main>
    </div>
  );
}
