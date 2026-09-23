import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { authClient } from '../../lib/auth-client';
import { AdminDisabled } from '../../components/ProtectedRoute.jsx';
import AuthBrandPanel from '../../components/admin/AuthBrandPanel.jsx';
import DevInstantAdmin from '../../components/admin/DevInstantAdmin.jsx';
import '../../styles/login.css';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function GoogleGIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.54-5.17 3.54-8.89z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28A7.19 7.19 0 0 1 4.91 12c0-.79.14-1.56.38-2.28V6.61H1.28a11.99 11.99 0 0 0 0 10.78l4.01-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.18 15.24 0 12 0 7.7 0 3.99 2.47 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.75 12 4.75z"
      />
    </svg>
  );
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  const [mode, setMode] = useState('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === 'sign-up';

  // Hooks above run unconditionally; only then branch on configuration/state.
  if (!API_BASE_URL) {
    return (
      <>
        <AdminDisabled />
        <DevInstantAdmin />
      </>
    );
  }

  if (!isPending && session) return <Navigate to="/admin" replace />;

  const switchMode = (next) => {
    setMode(next);
    setFieldErrors({});
    setFormError(null);
    setNotice(null);
    setPassword('');
    setShowPassword(false);
  };

  const clearFieldError = (field) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const validate = () => {
    const errs = {};
    if (isSignUp && !name.trim()) errs.name = 'Add your name.';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (!password) {
      errs.password = 'Enter your password.';
    } else if (isSignUp && password.length < MIN_PASSWORD_LENGTH) {
      errs.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    const clean = Object.fromEntries(Object.entries(errs).filter(([, v]) => v));
    setFieldErrors(clean);
    return Object.keys(clean).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    setNotice(null);
    if (!validate()) return;

    setBusy(true);
    try {
      if (isSignUp) {
        const { data, error } = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        if (error) {
          setFormError(error.message || 'Could not create the account. Try again.');
          return;
        }
        if (data?.token) {
          // Account created and signed in — go straight to the dashboard.
          navigate('/admin', { replace: true });
          return;
        }
        // Email verification required: no session yet.
        setNotice('Account created. Check your inbox to verify it, then sign in.');
        setMode('sign-in');
        setFieldErrors({});
        setPassword('');
        return;
      }

      const { error } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (error) {
        setFormError(error.message || 'Could not sign in. Check your email and password.');
        return;
      }
      navigate('/admin', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setFormError(null);
    setNotice(null);
    setBusy(true);
    const { error } = await authClient.signIn.social({
      provider: 'google',
      callbackURL: '/admin',
    });
    if (error) {
      setFormError(error.message || 'Google sign-in failed. Try again.');
      setBusy(false);
    }
    // On success the browser redirects to Google, so we stay busy.
  };

  return (
    <div className="login-page">
      <div className="login-stage">
        <AuthBrandPanel />

        <main className="login-panel">
          <div className="login-card">
            <header className="login-card-head">
              <span className="gdg-badge">Admin</span>
              <h2>{isSignUp ? 'Create your admin account' : 'Sign in to the admin'}</h2>
              <p>
                {isSignUp
                  ? 'Set up an email and password for the GDG-CTU admin.'
                  : 'Use the account you use for the chapter — or continue with Google.'}
              </p>
            </header>

            {formError ? (
              <div className="login-alert" role="alert">
                {formError}
              </div>
            ) : null}
            {notice ? (
              <div className="login-notice" role="status">
                {notice}
              </div>
            ) : null}

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              {isSignUp ? (
                <div className={`login-field${fieldErrors.name ? ' has-error' : ''}`}>
                  <label htmlFor="login-name">Full name</label>
                  <input
                    id="login-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      clearFieldError('name');
                    }}
                    aria-invalid={fieldErrors.name ? 'true' : undefined}
                    aria-describedby={fieldErrors.name ? 'login-name-error' : undefined}
                  />
                  {fieldErrors.name ? (
                    <p className="login-field-error" id="login-name-error" role="alert">
                      {fieldErrors.name}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className={`login-field${fieldErrors.email ? ' has-error' : ''}`}>
                <label htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearFieldError('email');
                  }}
                  aria-invalid={fieldErrors.email ? 'true' : undefined}
                  aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
                />
                {fieldErrors.email ? (
                  <p className="login-field-error" id="login-email-error" role="alert">
                    {fieldErrors.email}
                  </p>
                ) : null}
              </div>

              <div className={`login-field${fieldErrors.password ? ' has-error' : ''}`}>
                <label htmlFor="login-password">Password</label>
                <div className="login-password-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearFieldError('password');
                    }}
                    aria-invalid={fieldErrors.password ? 'true' : undefined}
                    aria-describedby={
                      fieldErrors.password
                        ? 'login-password-error'
                        : isSignUp
                          ? 'login-password-hint'
                          : undefined
                    }
                  />
                  <button
                    type="button"
                    className="login-peek"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {isSignUp && !fieldErrors.password ? (
                  <p className="login-hint" id="login-password-hint">
                    At least {MIN_PASSWORD_LENGTH} characters.
                  </p>
                ) : null}
                {fieldErrors.password ? (
                  <p className="login-field-error" id="login-password-error" role="alert">
                    {fieldErrors.password}
                  </p>
                ) : null}
              </div>

              <button type="submit" className="login-submit" disabled={busy}>
                {busy && !isSignUp ? <span className="login-spinner" aria-hidden="true" /> : null}
                {busy
                  ? isSignUp
                    ? 'Creating account…'
                    : 'Signing in…'
                  : isSignUp
                    ? 'Create account'
                    : 'Sign in'}
              </button>
            </form>

            <div className="login-divider" aria-hidden="true">
              <span>or</span>
            </div>

            <button
              type="button"
              className="login-google"
              onClick={handleGoogle}
              disabled={busy}
            >
              <GoogleGIcon />
              Continue with Google
            </button>

            <p className="login-switch">
              {isSignUp ? (
                <>
                  Already have an account?{' '}
                  <button type="button" onClick={() => switchMode('sign-in')}>
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Need an account?{' '}
                  <button type="button" onClick={() => switchMode('sign-up')}>
                    Create one
                  </button>
                </>
              )}
            </p>
          </div>

          <DevInstantAdmin />

          <Link className="login-back" to="/">
            ← Back to the public site
          </Link>
        </main>
      </div>
    </div>
  );
}
