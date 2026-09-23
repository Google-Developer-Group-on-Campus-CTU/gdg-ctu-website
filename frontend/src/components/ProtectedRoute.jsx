import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { authClient } from '../lib/auth-client';

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
  // The session check always runs — there is no client-side bypass anymore.
  // (The backend removed DEV_ADMIN_BYPASS in requireAuth; a flag that only
  // exists client-side let unauthenticated visits render the admin shell.)
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

function ProtectedAdminRoutes() {
  const { data: session, isPending } = authClient.useSession();
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
  // A real Better Auth session always carries `user`. Once the check has
  // settled, anything else — signed out, a stale cookie that failed
  // re-verification, a failed check — goes straight to the login screen.
  // Never fall through to <Outlet/> without a valid session: that is what
  // let admin children mount and fire protected endpoints unauthenticated.
  if (!session?.user) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}
