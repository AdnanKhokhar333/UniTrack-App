import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import BrandMark from "../components/BrandMark";

function MailIcon() {
  return (
    <svg
      className="login-field-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function LockIcon({ className = "login-field-icon" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.3 17.3 0 0 1-2.2 3.1" />
      <path d="M6.1 6.1C4 7.7 2.5 10 2 12c0 0 3.5 7 10 7a10.8 10.8 0 0 0 4.4-.9" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState("admin@university.edu");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/login", { email, password });
      if (data.user?.role !== "admin") {
        setError("Admin accounts only on this dashboard.");
        return;
      }
      login(data.access_token, data.user);
      navigate("/", { replace: true });
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Login failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <BrandMark className="login-brand" />
        <h1>Admin Console Sign In</h1>
        <p className="muted login-subtitle">
          Sign in to manage university buses, live routes, and student transport
          operations.
        </p>

        {error && (
          <div className="login-error-banner" role="alert">
            {error}
          </div>
        )}

        <label>
          Email
          <span className="login-input-wrap">
            <MailIcon />
            <input
              type="email"
              className="login-input login-input--with-icon"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </span>
        </label>

        <label>
          Password
          <span className="login-input-wrap">
            <LockIcon />
            <input
              type={showPassword ? "text" : "password"}
              className="login-input login-input--with-icon login-input--with-toggle"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </span>
        </label>

        <button type="submit" className="primary-cta login-submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="login-security-footer">
          <LockIcon className="login-security-icon" />
          Authorized university transport administrators only.
        </p>
      </form>
    </div>
  );
}
