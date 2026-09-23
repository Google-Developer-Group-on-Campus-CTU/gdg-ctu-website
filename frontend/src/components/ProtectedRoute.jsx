import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { isDevAdminBypass } from '../api/client.js';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

/** If Clerk's isLoaded stays false this long, show an error card instead of an endless loader. */
const CLERK_LOAD_TIMEOUT_MS = 8000;

export function AdminDisabled() {
  return (
    <div className="gdg-container">
      <section className="gdg-section">
        <span className="gdg-badge">Admin</span>
        <h2>Admin disabled in local dev</h2>
        <p className="gdg-subtitle">
          No Clerk publishable key is set (VITE_CLERK_PUBLISHABLE_KEY). Set
          the key to enable the admin area.
        </p>
      </section>
    </div>
  );
}

export default function ProtectedRoute() {
  // Dev bypass: skip Clerk entirely (works with or without a publishable key).
  if (isDevAdminBypass()) return <Outlet />;
  if (!clerkPubKey) return <AdminDisabled />;
  return <ProtectedAdminRoutes />;
}

function ClerkLoadTimedOut() {
  return (
    <div className="gdg-container">
      <section className="gdg-section">
        <span className="gdg-badge">Admin</span>
        <h2>Admin sign-in timed out</h2>
        <p className="gdg-subtitle">
          Clerk did not finish loading within {CLERK_LOAD_TIMEOUT_MS / 1000}{' '}
          seconds. Check your connection and try again.
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
  const { isLoaded, isSignedIn } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return undefined;
    const timer = setTimeout(() => setTimedOut(true), CLERK_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  if (!isLoaded) {
    if (timedOut) return <ClerkLoadTimedOut />;
    return <p>Loading…</p>;
  }
  if (!isSignedIn) return <Navigate to="/admin/login" replace />;
  return <Outlet />;
}
