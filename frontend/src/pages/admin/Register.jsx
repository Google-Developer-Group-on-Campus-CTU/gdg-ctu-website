import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { authClient } from '../../lib/auth-client';
import { AdminDisabled } from '../../components/ProtectedRoute.jsx';
import { checkInvite, formatWhen, redeemInvite } from '../../api/admin-invites.js';
import { API_BASE_URL } from '../../api/client.js';
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
  const [fieldErrors, setFieldErrors, clearFieldError] = useFieldErrors({});
  const [formError, setFormError] = useState(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [created, setCreated] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!API_BASE_URL) return undefined;
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

  if (!API_BASE_URL) return <AdminDisabled />;
  if (!isPending && session?.user) return <Navigate to="/admin" replace />;

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

  const status = !token ? 'missing' : tokenState.status;
  const invalid = invalidCopy(tokenState.reason);

  return (
    <AuthShell showDecor={false}>
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
          <p className="gdg-btn-row">
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
            <p className="login-hint gdg-hint-offset">
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
            <p className="login-hint gdg-hint-offset">
              This invite expires {formatWhen(tokenState.expiresAt)}.
            </p>
          ) : null}

          <AuthAlert message={formError ? (
            <>
              {formError}
              {emailTaken ? (
                <>
                  {' '}
                  <Link to="/admin/login">Sign in</Link>
                </>
              ) : null}
            </>
          ) : null} />

          <form className="login-form" onSubmit={handleSubmit} noValidate>
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
              hint={!fieldErrors.password ? `At least ${MIN_PASSWORD_LENGTH} characters.` : null}
              hintId="login-password-hint"
              autoComplete="new-password"
              show={showPassword}
              setShow={setShowPassword}
              onChange={(e) => {
                setPassword(e.target.value);
                clearFieldError('password');
              }}
            />

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
      <Link className="login-back gdg-back-link" to="/">
        ← Back to the public site
      </Link>
    </AuthShell>
  );
}
