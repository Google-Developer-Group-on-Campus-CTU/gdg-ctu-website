import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { authClient } from '../../lib/auth-client';
import { apiFetch, API_BASE_URL } from '../../api/client.js';
import { AdminDisabled } from '../../components/ProtectedRoute.jsx';
import {
  EMAIL_RE,
  MIN_PASSWORD_LENGTH,
  useFieldErrors,
  AuthField,
  AuthInput,
  PasswordField,
  AuthAlert,
  AuthShell,
} from '../../components/admin/AuthForm.jsx';
import '../../styles/login.css';

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

  const [setupStatus, setSetupStatus] = useState('checking');
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors, clearFieldError] = useFieldErrors({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!API_BASE_URL) return undefined;
    let alive = true;
    apiFetch('/public/auth/setup-status')
      .then((data) => {
        if (!alive) return;
        setSetupNeeded(Boolean(data?.setupNeeded));
        setSetupStatus('ready');
      })
      .catch(() => {
        if (!alive) return;
        setSetupNeeded(false);
        setSetupStatus('ready');
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!API_BASE_URL) return <AdminDisabled />;

  if (!isPending && session?.user) return <Navigate to="/admin" replace />;

  const validate = () => {
    const errs = {};
    if (setupNeeded && !name.trim()) errs.name = 'Add your name.';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (!password) {
      errs.password = setupNeeded ? 'Choose a password.' : 'Enter your password.';
    } else if (setupNeeded && password.length < MIN_PASSWORD_LENGTH) {
      errs.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (setupNeeded && confirm !== password) errs.confirm = "Passwords don't match.";
    const clean = Object.fromEntries(Object.entries(errs).filter(([, v]) => v));
    setFieldErrors(clean);
    return Object.keys(clean).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setBusy(true);
    try {
      if (setupNeeded) {
        const { error } = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        if (error) {
          setFormError(error.message || 'Could not create the first admin account.');
          return;
        }
        navigate('/admin', { replace: true });
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
    setBusy(true);
    try {
      const { error } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: '/admin',
      });
      if (error) {
        setFormError(error.message || 'Google sign-in failed. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      {setupStatus === 'checking' ? (
        <>
          <header className="login-card-head">
            <span className="gdg-badge">Admin</span>
            <h2>Checking admin setup…</h2>
            <p>One quick check before you sign in.</p>
          </header>
          <div className="gdg-loading" role="status">
            <span className="gdg-spinner" aria-hidden="true" />
            <p>Checking…</p>
          </div>
        </>
      ) : (
        <>
          <header className="login-card-head">
            <span className="gdg-badge">Admin</span>
            {setupNeeded ? (
              <>
                <h2>Create the first admin</h2>
                <p>No admins exist yet — this account becomes the chapter admin and can invite others.</p>
              </>
            ) : (
              <>
                <h2>Welcome back</h2>
                <p>Sign in to update events, team, gallery and content. Changes appear on the public site right away.</p>
              </>
            )}
          </header>

          <AuthAlert message={formError} />

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            {setupNeeded ? (
              <AuthField id="login-name" label="Full name" error={fieldErrors.name}>
                <AuthInput
                  id="login-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    clearFieldError('name');
                  }}
                  error={fieldErrors.name}
                />
              </AuthField>
            ) : null}

            <AuthField id="login-email" label="Email" error={fieldErrors.email}>
              <AuthInput
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError('email');
                }}
                error={fieldErrors.email}
              />
            </AuthField>

            <PasswordField
              id="login-password"
              label="Password"
              value={password}
              error={fieldErrors.password}
              hint={setupNeeded && !fieldErrors.password ? `At least ${MIN_PASSWORD_LENGTH} characters.` : null}
              hintId="login-password-hint"
              autoComplete={setupNeeded ? 'new-password' : 'current-password'}
              show={showPassword}
              setShow={setShowPassword}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError('password');
              }}
            />

            {setupNeeded ? (
              <PasswordField
                id="login-confirm"
                label="Confirm password"
                value={confirm}
                error={fieldErrors.confirm}
                autoComplete="new-password"
                show={showConfirm}
                setShow={setShowConfirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  clearFieldError('confirm');
                }}
              />
            ) : null}

            <button type="submit" className="login-submit" disabled={busy}>
              {busy ? <span className="login-spinner" aria-hidden="true" /> : null}
              {busy
                ? setupNeeded
                  ? 'Creating account…'
                  : 'Signing in…'
                : setupNeeded
                  ? 'Create first admin'
                  : 'Sign in'}
            </button>
          </form>

          <div className="login-divider" aria-hidden="true">
            <span>or</span>
          </div>

          <button type="button" className="login-google" onClick={handleGoogle} disabled={busy}>
            <GoogleGIcon />
            Continue with Google
          </button>

          {setupNeeded ? (
            <p className="login-switch">The first Google account you sign in with also becomes the site admin.</p>
          ) : (
            <p className="login-switch">
              Need an account? Ask an admin for an invite link, then <Link to="/admin/register">register</Link>.
            </p>
          )}
        </>
      )}
      <Link className="login-back gdg-back-link" to="/">
        ← Back to the public site
      </Link>
    </AuthShell>
  );
}
