import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { authClient } from '../../lib/auth-client';
import { AdminDisabled } from '../../components/ProtectedRoute.jsx';
import AuthBrandPanel from '../../components/admin/AuthBrandPanel.jsx';
import { checkInvite, formatWhen, redeemInvite } from '../../api/admin-invites.js';
import '../../styles/login.css';

const API_BASE_URL = import.meta.env.VITE_API_URL;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/** Only trust the contract's reason values; anything else falls back to generic copy. */
function normalizeReason(reason) {
  return reason === 'invalid' || reason === 'used' || reason === 'expired'
    ? reason
    : null;
}

function invalidCopy(reason) {
  if (reason === 'used') {
    return {
      title: 'This invite was already used',
      body: 'Invite links work exactly once. Ask an admin to send you a fresh one.',
    };
  }
  if (reason === 'expired') {
    return {
      title: 'This invite has expired',
      body: 'Invite links stop working after their expiry date. Ask an admin for a new link.',
    };
  }
  if (reason === 'invalid') {
    return {
      title: "This invite link isn't valid",
      body: 'Check that the full link opened — or ask an admin to send a new one.',
    };
  }
  return {
    title: "This invite can't be used",
    body: 'Ask an admin to send you a new invite link.',
  };
}

function serverMessage(err, fallback) {
  const body = err?.body;
  const msg =
    typeof body === 'object' && body !== null ? (body.message ?? body.error) : null;
  return typeof msg === 'string' && msg ? msg : fallback;
}

function CardHead({ title, sub }) {
  return (
    <header className="login-card-head">
      <span className="gdg-badge">Admin</span>
      <h2>{title}</h2>
      <p>{sub}</p>
    </header>
  );
}

export default function AdminRegister() {
  const [params] = useSearchParams();
  const token = (params.get('token') ?? '').trim();
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  const [tokenState, setTokenState] = useState(() => ({
    status: token ? 'validating' : 'missing',
    reason: null,
    expiresAt: null,
  }));
  const [checkAttempt, setCheckAttempt] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);

  // Validate the invite once per token (and again on Retry). Retry sets the
  // 'validating' state in its click handler, so this effect never has to.
  useEffect(() => {
    if (!token) return undefined;
    let alive = true;
    checkInvite(token)
      .then((result) => {
        if (!alive) return;
        if (result?.valid) {
          setTokenState({
            status: 'ok',
            reason: null,
            expiresAt: result.expiresAt ?? null,
          });
        } else {
          setTokenState({
            status: 'invalid',
            reason: normalizeReason(result?.reason),
            expiresAt: result?.expiresAt ?? null,
          });
        }
      })
      .catch((err) => {
        if (!alive) return;
        if (err?.status === 404) {
          setTokenState({ status: 'invalid', reason: 'invalid', expiresAt: null });
        } else if (err?.status === 410) {
          setTokenState({
            status: 'invalid',
            reason: normalizeReason(err?.body?.reason),
            expiresAt: null,
          });
        } else {
          setTokenState({ status: 'error', reason: null, expiresAt: null });
        }
      });
    return () => {
      alive = false;
    };
  }, [token, checkAttempt]);

  // Hooks above run unconditionally; only then branch on configuration/state.
  if (!API_BASE_URL) return <AdminDisabled />;
  // Same predicate as ProtectedRoute — a real session always carries `user`.
  if (!isPending && session?.user) return <Navigate to="/admin" replace />;

  const clearFieldError = (field) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Add your name.';
    if (!EMAIL_RE.test(email.trim())) errs.email = 'Enter a valid email address.';
    if (!password) {
      errs.password = 'Choose a password.';
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errs.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (confirm !== password) errs.confirm = "Passwords don't match.";
    const clean = Object.fromEntries(Object.entries(errs).filter(([, v]) => v));
    setFieldErrors(clean);
    return Object.keys(clean).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError(null);
    setEmailTaken(false);
    if (!validate()) return;

    setBusy(true);
    try {
      try {
        await redeemInvite({
          token,
          name: name.trim(),
          email: email.trim(),
          password,
        });
      } catch (err) {
        if (err?.status === 404) {
          setTokenState((prev) => ({
            status: 'invalid',
            reason: 'invalid',
            expiresAt: prev.expiresAt,
          }));
          return;
        }
        if (err?.status === 410) {
          setTokenState((prev) => ({
            status: 'invalid',
            reason: normalizeReason(err?.body?.reason),
            expiresAt: prev.expiresAt,
          }));
          return;
        }
        if (err?.status === 409) {
          setEmailTaken(true);
          setFormError('An account with this email already exists — sign in instead.');
          return;
        }
        setFormError(serverMessage(err, 'Could not create the account. Try again.'));
        return;
      }

      // 201 — account exists now; sign in with the credentials just chosen.
      const { error: signInError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setCreated(true);
        return;
      }
      navigate('/admin', { replace: true });
    } finally {
      setBusy(false);
    }
  };

  // 'missing' is derived from the URL, not stored — a token that disappears
  // mid-mount shows the missing card without a state write.
  const status = !token ? 'missing' : tokenState.status;
  const invalid = invalidCopy(tokenState.reason);

  return (
    <div className="login-page">
      <div className="login-stage">
        <AuthBrandPanel />

        <main className="login-panel">
          <div className="login-card">
            {status === 'validating' ? (
              <>
                <CardHead
                  title="Set up your account"
                  sub="One quick check before you create your admin account."
                />
                <div className="gdg-loading" role="status">
                  <span className="gdg-spinner" aria-hidden="true" />
                  <p>Checking your invite…</p>
                </div>
              </>
            ) : null}

            {status === 'missing' ? (
              <>
                <CardHead
                  title="Invite link incomplete"
                  sub="This page needs an invite token in the address. Open the full link an admin sent you — it looks like /admin/register?token=…"
                />
                <Link className="gdg-btn gdg-btn-primary" to="/admin/login">
                  Go to sign in
                </Link>
              </>
            ) : null}

            {status === 'error' ? (
              <>
                <CardHead
                  title="Couldn't check your invite"
                  sub="The invite service didn't respond. Check your connection, then try again."
                />
                <p style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="gdg-btn gdg-btn-primary"
                    onClick={() => {
                      setTokenState({
                        status: 'validating',
                        reason: null,
                        expiresAt: null,
                      });
                      setCheckAttempt((n) => n + 1);
                    }}
                  >
                    Retry
                  </button>
                  <Link to="/admin/login">Go to sign in</Link>
                </p>
              </>
            ) : null}

            {status === 'invalid' ? (
              <>
                <CardHead title={invalid.title} sub={invalid.body} />
                {tokenState.expiresAt ? (
                  <p className="login-hint" style={{ marginTop: '-0.75rem' }}>
                    {tokenState.reason === 'expired' || tokenState.reason === 'used'
                      ? `Invite expired ${formatWhen(tokenState.expiresAt)}.`
                      : `This invite was set to expire ${formatWhen(tokenState.expiresAt)}.`}
                  </p>
                ) : null}
                <Link className="gdg-btn gdg-btn-primary" to="/admin/login">
                  Go to sign in
                </Link>
              </>
            ) : null}

            {created ? (
              <>
                <CardHead
                  title="Account created"
                  sub={`You're all set${email ? `, ${email.trim()}` : ''}.`}
                />
                <div className="login-notice" role="status">
                  Automatic sign-in didn't complete. Sign in with the password you
                  just set.
                </div>
                <Link className="gdg-btn gdg-btn-primary" to="/admin/login">
                  Go to sign in
                </Link>
              </>
            ) : null}

            {status === 'ok' && !created ? (
              <>
                <CardHead
                  title="Set up your account"
                  sub="This invite lets you create one GDG-CTU admin account. Pick a name and password."
                />
                {tokenState.expiresAt ? (
                  <p className="login-hint" style={{ marginTop: '-0.75rem' }}>
                    This invite expires {formatWhen(tokenState.expiresAt)}.
                  </p>
                ) : null}

                {formError ? (
                  <div className="login-alert" role="alert">
                    {formError}
                    {emailTaken ? (
                      <>
                        {' '}
                        <Link to="/admin/login">Sign in</Link>
                      </>
                    ) : null}
                  </div>
                ) : null}

                <form className="login-form" onSubmit={handleSubmit} noValidate>
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
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          clearFieldError('password');
                        }}
                        aria-invalid={fieldErrors.password ? 'true' : undefined}
                        aria-describedby={
                          fieldErrors.password
                            ? 'login-password-error'
                            : 'login-password-hint'
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
                    {!fieldErrors.password ? (
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

                  <div className={`login-field${fieldErrors.confirm ? ' has-error' : ''}`}>
                    <label htmlFor="login-confirm">Confirm password</label>
                    <div className="login-password-wrap">
                      <input
                        id="login-confirm"
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={confirm}
                        onChange={(e) => {
                          setConfirm(e.target.value);
                          clearFieldError('confirm');
                        }}
                        aria-invalid={fieldErrors.confirm ? 'true' : undefined}
                        aria-describedby={
                          fieldErrors.confirm ? 'login-confirm-error' : undefined
                        }
                      />
                      <button
                        type="button"
                        className="login-peek"
                        aria-pressed={showConfirm}
                        onClick={() => setShowConfirm((v) => !v)}
                      >
                        {showConfirm ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    {fieldErrors.confirm ? (
                      <p className="login-field-error" id="login-confirm-error" role="alert">
                        {fieldErrors.confirm}
                      </p>
                    ) : null}
                  </div>

                  <button type="submit" className="login-submit" disabled={busy}>
                    {busy ? <span className="login-spinner" aria-hidden="true" /> : null}
                    {busy ? 'Creating account…' : 'Create account'}
                  </button>
                </form>

                <p className="login-switch">
                  Already have an account?{' '}
                  <Link to="/admin/login">Sign in</Link>
                </p>
              </>
            ) : null}
          </div>

          <Link className="login-back" to="/">
            ← Back to the public site
          </Link>
        </main>
      </div>
    </div>
  );
}
