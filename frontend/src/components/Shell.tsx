import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { clearStoredAuth, getStoredToken, getStoredUserType } from "../api/client";

interface ShellProps {
  title: string;
  children: ReactNode;
}

export function Shell({ title, children }: ShellProps) {
  const navigate = useNavigate();
  const token = getStoredToken();
  const userType = getStoredUserType();
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
        <div className="shell-hero">
          <div className="shell-hero__content">
            <span className="section-kicker">Hiring operations</span>
            <h1>{title}</h1>
            <p>Bias gets designed out of the workflow before hiring decisions are made.</p>
          </div>
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
