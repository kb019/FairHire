import { Navigate, Route, Routes } from "react-router-dom";
import { getStoredToken, getStoredUserType } from "./api/client";
import { ApplicantDashboardPage } from "./pages/ApplicantDashboard";
import { CandidateReviewPage } from "./pages/CandidateReview";
import { HomePage } from "./pages/Home";
import { HRDashboardPage } from "./pages/HRDashboard";
import { JobPostingEditorPage } from "./pages/JobPostingEditor";
import { LoginPage } from "./pages/Login";
import { RegisterApplicantPage } from "./pages/RegisterApplicant";
import { RegisterHRPage } from "./pages/RegisterHR";

interface ProtectedRouteProps {
  allowed: "hr" | "applicant";
  children: JSX.Element;
}

function getDefaultRoute(userType: string | null) {
  return userType === "hr" ? "/hr" : userType === "applicant" ? "/applicant" : "/login";
}

function ProtectedRoute({ allowed, children }: ProtectedRouteProps) {
  const token = getStoredToken();
  const userType = getStoredUserType();

  if (!token) {
    return <Navigate replace to="/login" />;
  }

  if (userType !== allowed) {
    return <Navigate replace to={getDefaultRoute(userType)} />;
  }

  return children;
}

function PublicOnlyRoute({ children }: { children: JSX.Element }) {
  const token = getStoredToken();
  const userType = getStoredUserType();

  if (token && userType) {
    return <Navigate replace to={getDefaultRoute(userType)} />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<HomePage />} path="/" />
      <Route
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
        path="/login"
      />
      <Route
        element={
          <PublicOnlyRoute>
            <RegisterHRPage />
          </PublicOnlyRoute>
        }
        path="/register/hr"
      />
      <Route
        element={
          <PublicOnlyRoute>
            <RegisterApplicantPage />
          </PublicOnlyRoute>
        }
        path="/register/applicant"
      />
      <Route
        element={
          <ProtectedRoute allowed="hr">
            <HRDashboardPage />
          </ProtectedRoute>
        }
        path="/hr"
      />
      <Route
        element={
          <ProtectedRoute allowed="hr">
            <JobPostingEditorPage />
          </ProtectedRoute>
        }
        path="/hr/editor"
      />
      <Route
        element={
          <ProtectedRoute allowed="hr">
            <CandidateReviewPage />
          </ProtectedRoute>
        }
        path="/hr/job-postings/:jobPostingId"
      />
      <Route
        element={
          <ProtectedRoute allowed="applicant">
            <ApplicantDashboardPage />
          </ProtectedRoute>
        }
        path="/applicant"
      />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  );
}
