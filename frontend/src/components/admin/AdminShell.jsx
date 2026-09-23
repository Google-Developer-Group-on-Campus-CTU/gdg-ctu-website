import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { authClient } from '../../lib/auth-client';
import { adminNewTargetFor } from '../../admin/editorial.js';
import '../../styles/admin.css';

export const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/events', label: 'Events' },
  { to: '/admin/team', label: 'Team' },
  { to: '/admin/partners', label: 'Partners' },
  { to: '/admin/gallery', label: 'Gallery' },
  { to: '/admin/content', label: 'Content' },
  { to: '/admin/media', label: 'Media' },
  { to: '/admin/invites', label: 'Invites' },
  { to: '/admin/settings', label: 'Settings' },
];

function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  // Show at depth >= 2 relative to /admin (e.g. /admin/events/abc -> Events / abc)
  if (segments.length < 2 || segments[0] !== 'admin') return null;
  const crumbs = segments.slice(1).map((seg, i) => {
    const href = `/admin/${segments.slice(1, i + 2).join('/')}`;
    const label = seg === 'albums' ? 'Gallery' : decodeURIComponent(seg).replace(/-/g, ' ');
    return { href, label, last: i === segments.slice(1).length - 1 };
  });
  return (
    <nav aria-label="Breadcrumb" className="admin-crumbs">
      <Link to="/admin">Admin</Link>
      {crumbs.map((c) => (
        <span key={c.href}>
          <span aria-hidden="true"> / </span>
          {c.last ? (
            <span aria-current="page">{c.label}</span>
          ) : (
            <Link to={c.href}>{c.label}</Link>
          )}
        </span>
      ))}
    </nav>
  );
}

function Identity() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const user = session?.user;
  const name = user?.name || user?.email || 'Admin';
  const initial = String(name).trim().charAt(0).toUpperCase() || 'A';

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
    } finally {
      navigate('/admin/login', { replace: true });
    }
  };

  return (
    <div className="admin-identity">
      <span className="admin-avatar" aria-hidden="true">{initial}</span>
      <span className="admin-identity-name" title={name}>{name}</span>
      <button
        type="button"
        className="admin-link-btn"
        onClick={handleSignOut}
      >
        Sign out
      </button>
    </div>
  );
}

export default function AdminShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const { data: session } = authClient.useSession();
  const query = params.get('q') ?? '';

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Defense in depth behind ProtectedRoute: the shell (and every list page
  // under it) may only render with a live session — no session means no
  // protected fetches should ever fire from admin children.
  if (!session?.user) return <Navigate to="/admin/login" replace />;

  const nav = (
    <nav aria-label="Admin primary" className="admin-nav">
      <ul>
        {ADMIN_NAV.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'admin-nav-link is-active' : 'admin-nav-link')}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Admin sidebar">
        <Link to="/admin" className="admin-brand">
          <span className="admin-brand-mark" aria-hidden="true">G</span>
          <span>GDG-CTU Admin</span>
        </Link>
        {nav}
        <p className="admin-sidebar-note">CMS writes content. Public site reads it.</p>
      </aside>

      <div className="admin-main-col">
        <header className="admin-topbar">
          <button
            type="button"
            className="admin-menu-btn"
            aria-label={drawerOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            ☰
          </button>
          <form
            className="admin-search"
            role="search"
            onSubmit={(e) => e.preventDefault()}
          >
            <label className="admin-visually-hidden" htmlFor="admin-search">Search this section</label>
            <input
              id="admin-search"
              type="search"
              placeholder="Search this section…"
              value={query}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                if (e.target.value) next.set('q', e.target.value);
                else next.delete('q');
                setParams(next, { replace: true });
              }}
            />
          </form>
          <Identity />
          <Link className="gdg-btn gdg-btn-primary admin-new-btn" to={adminNewTargetFor(location.pathname)}>
            + New
          </Link>
        </header>

        <main className="admin-main">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>

      {drawerOpen ? (
        <div className="admin-drawer-backdrop" onClick={() => setDrawerOpen(false)} role="presentation">
          <div className="admin-drawer" role="dialog" aria-modal="true" aria-label="Admin navigation" onClick={(e) => e.stopPropagation()}>
            <div className="admin-drawer-head">
              <strong>GDG-CTU Admin</strong>
              <button type="button" aria-label="Close navigation" onClick={() => setDrawerOpen(false)}>✕</button>
            </div>
            {nav}
          </div>
        </div>
      ) : null}
    </div>
  );
}
