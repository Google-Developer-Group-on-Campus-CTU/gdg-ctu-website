import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { authClient } from '../lib/auth-client';
import { isDevAdminBypass } from '../api/client.js';

const API_BASE_URL = import.meta.env.VITE_API_URL;

/** If the session check stays pending this long, show an error card instead of an endless loader. */
const SESSION_LOAD_TIMEOUT_MS = 8000;

export function AdminDisabled() {
  return (
    <div className="gdg-container">
      <section className="gdg-section">
        <span className="gdg-badge">Admin</span>
        <h2>Admin is not configured</h2>
        <p className="gdg-subtitle">
          No backend address is set (<code>VITE_API_URL</code>). Add it to{' '}
          <code>frontend/.env</code> — for local work:{' '}
          <code>http://localhost:3000/GDGoC-CTU-Main/v0.0.1</code> — then
          restart the dev server.
        </p>
      </section>
    </div>
  );
}

export default function ProtectedRoute() {
  // Dev bypass: skip the session check entirely (flag set by DevInstantAdmin).
  if (isDevAdminBypass()) return <Outlet />;
  if (!API_BASE_URL) return <AdminDisabled />;
  return <ProtectedAdminRoutes />;
}

function SessionLoading() {
  return (
    <div className="gdg-container">
      <section className="gdg-section gdg-loading" role="status">
        <span className="gdg-spinner" aria-hidden="true" />
        <p>Checking your session…</p>
      </section>
    </div>
  );
}

function SessionLoadTimedOut() {
  return (
    <div className="gdg-container">
      <section className="gdg-section">
        <span className="gdg-badge">Admin</span>
        <h2>Sign-in check timed out</h2>
        <p className="gdg-subtitle">
          The backend did not answer within {SESSION_LOAD_TIMEOUT_MS / 1000}{' '}
          seconds. Check that it is running, then try again.
        </p>
        <p style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            type="button"
            className="gdg-btn gdg-btn-primary"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
          <Link to="/admin/login">Go to sign in</Link>
        </p>
      </section>
    </div>
  );
}

function SessionCheckFailed({ error, onRetry }) {
  const detail =
    typeof error?.message === 'string' && error.message ? error.message : null;
  return (
    <div className="gdg-container">
      <section className="gdg-section">
        <span className="gdg-badge">Admin</span>
        <h2>Could not check your session</h2>
        <p className="gdg-subtitle">
          {detail ??
            'The sign-in service did not respond. Check that the backend is running, then try again.'}
        </p>
        <p style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            type="button"
            className="gdg-btn gdg-btn-primary"
            onClick={() => onRetry()}
          >
            Retry
          </button>
          <Link to="/admin/login">Go to sign in</Link>
        </p>
      </section>
    </div>
  );
}

function ProtectedAdminRoutes() {
  const { data: session, isPending, error, refetch } = authClient.useSession();
  const [timedOut, setTimedOut] = useState(false);

  // React-endorsed render-time adjustment: once the check settles, forget any
  // previous timeout so a later refetch gets a full grace period again.
  if (!isPending && timedOut) setTimedOut(false);

  useEffect(() => {
    if (!isPending) return undefined;
    const timer = setTimeout(() => setTimedOut(true), SESSION_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isPending]);

  if (isPending) {
    if (timedOut) return <SessionLoadTimedOut />;
    return <SessionLoading />;
  }
  if (error && !session) return <SessionCheckFailed error={error} onRetry={refetch} />;
  if (!session) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}
