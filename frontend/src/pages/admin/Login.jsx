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
        </>
      )}
      <Link className="login-back gdg-back-link" to="/">
        ← Back to the public site
      </Link>
    </AuthShell>
  );
}
