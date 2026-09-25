import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Users, Handshake, Images, GalleryHorizontal, Layers, FileText, Mail, Settings, LogOut, MoreHorizontal } from 'lucide-react';
import { authClient } from '../../lib/auth-client';
import { ADMIN_ENTITY_ROUTES } from '../../admin/editorial.js';
import '../../styles/admin.css';

const NAV_ICONS = {
  '/admin': LayoutDashboard,
  '/admin/events': CalendarDays,
  '/admin/team': Users,
  '/admin/partners': Handshake,
  '/admin/gallery': Images,
  '/admin/gallery-categories': Layers,
  '/admin/terms': FileText,
  '/admin/media': GalleryHorizontal,
  '/admin/invites': Mail,
  '/admin/users': Users,
  '/admin/settings': Settings,
};

export const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', end: true, kind: 'dashboard' },
  ...Object.values(ADMIN_ENTITY_ROUTES).map((entity) => ({ to: entity.list, label: entity.label, kind: 'entity' })),
  { to: '/admin/invites', label: 'Invites', kind: 'system' },
  { to: '/admin/users', label: 'Users', kind: 'system' },
  { to: '/admin/settings', label: 'Settings', kind: 'system' },
];

const STORAGE_KEY = 'm3-admin-sidebar-collapsed';

// Spec §3.3 grouped drawer (11 destinations in 3 groups). Derived from
// ADMIN_NAV by path so labels/routes stay in sync with ADMIN_ENTITY_ROUTES.
const NAV_GROUPS = [
  { heading: 'Overview', tos: ['/admin'] },
  { heading: 'Content', tos: ['/admin/events', '/admin/team', '/admin/partners', '/admin/gallery', '/admin/gallery-categories', '/admin/terms'] },
  { heading: 'System', tos: ['/admin/media', '/admin/invites', '/admin/users', '/admin/settings'] },
];

function navItemByTo(to) {
  return ADMIN_NAV.find((item) => item.to === to);
}

// Spec §3.3 compact rail (explicit collapsed mode only): curated 5 —
// Dashboard, Events, Team, Partners, Media — + More (full grouped drawer).
// The rail never renders all 11 destinations.
const RAIL_TOS = ['/admin', '/admin/events', '/admin/team', '/admin/partners', '/admin/media'];

function NavItems({ items }) {
  return (
    <ul>
      {items.map((item) => {
        if (!item) return null;
        const Icon = NAV_ICONS[item.to] || LayoutDashboard;
        return (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'admin-nav-link is-active' : 'admin-nav-link')}
            >
              <span className="admin-nav-icon" aria-hidden="true"><Icon size={20} /></span>
              <span className="admin-nav-label">{item.label}</span>
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

function GroupedNav() {
  return (
    <nav aria-label="Admin primary" className="admin-nav">
      {NAV_GROUPS.map((group, gi) => (
        <section key={group.heading} aria-labelledby={`admin-nav-group-${group.heading.toLowerCase()}`}>
          <h2
            id={`admin-nav-group-${group.heading.toLowerCase()}`}
            style={{ margin: gi === 0 ? '4px 16px 4px' : '12px 16px 4px', fontSize: 12, fontWeight: 500, letterSpacing: '0.4px', color: 'var(--m3-on-surface-variant)' }}
          >
            {group.heading}
          </h2>
          <NavItems items={group.tos.map(navItemByTo)} />
          {gi < NAV_GROUPS.length - 1 ? (
            <hr aria-hidden="true" style={{ margin: '8px 16px 0', border: 'none', borderTop: '1px solid var(--m3-outline-variant)' }} />
          ) : null}
        </section>
      ))}
    </nav>
  );
}

function RailNav({ onMore }) {
  const items = RAIL_TOS.map(navItemByTo).filter(Boolean);
  return (
    <nav aria-label="Admin primary" className="admin-nav">
      <ul>
        {items.map((item) => {
          const Icon = NAV_ICONS[item.to] || LayoutDashboard;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => (isActive ? 'admin-nav-link is-active' : 'admin-nav-link')}
              >
                <span className="admin-nav-icon" aria-hidden="true"><Icon size={20} /></span>
                <span className="admin-nav-label">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            className="admin-nav-link"
            style={{ width: '100%', cursor: 'pointer', background: 'transparent', border: 'none', font: 'inherit' }}
            aria-haspopup="dialog"
            aria-label="More navigation options"
            onClick={onMore}
          >
            <span className="admin-nav-icon" aria-hidden="true"><MoreHorizontal size={20} /></span>
            <span className="admin-nav-label">More</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
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
        <span key={c.href} className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="text-[var(--m3-outline)]">/</span>
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

function SidebarIdentity() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const user = session?.user;
  const name = user?.name || user?.email || 'Admin';
  const email = user?.email || '';
  const initial = String(name).trim().charAt(0).toUpperCase() || 'A';
  const handleSignOut = async () => {
    try { await authClient.signOut(); } finally { navigate('/admin/login', { replace: true }); }
  };
  return (
    <div className="admin-sidebar-footer" role="contentinfo" aria-label="User account">
      <div className="admin-sidebar-identity">
        <span className="admin-avatar" aria-hidden="true">{initial}</span>
        <span className="admin-sidebar-identity-text">
          <span className="admin-sidebar-identity-name" title={name}>{name}</span>
          {email ? <span className="admin-sidebar-identity-email" title={email}>{email}</span> : null}
        </span>
      </div>
      <button type="button" className="admin-sidebar-signout" onClick={handleSignOut} aria-label="Sign out">
        <LogOut size={18} aria-hidden="true" />
        <span>Sign out</span>
      </button>
      <Link to="/" className="admin-sidebar-link" style={{ marginTop: 8, fontSize: 'var(--m3-typescale-body-small-size)' }}>View public site →</Link>
    </div>
  );
}

export default function AdminShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const location = useLocation();
  const drawerRef = useRef(null);
  const toggleBtnRef = useRef(null);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch {}
  }, [collapsed]);

  // Modal drawer: lock scroll, Esc, focus trap — for compact (<600px) only
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { setDrawerOpen(false); toggleBtnRef.current?.focus(); return; }
      if (e.key !== 'Tab') return;
      const root = drawerRef.current;
      if (!root) return;
      const items = root.querySelectorAll('a[href], button:not([disabled])');
      if (items.length === 0) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    drawerRef.current?.querySelector('a, button')?.focus();
    return () => { document.body.style.overflow = prevOverflow; document.removeEventListener('keydown', onKeyDown); };
  }, [drawerOpen]);

  // Handle hamburger: large ≥1200 toggles collapsed rail, compact toggles modal
  const handleHamburger = () => {
    const isLarge = window.matchMedia('(min-width: 1200px)').matches;
    if (isLarge) {
      setCollapsed((v) => !v);
      // keep focus on toggle for keyboard users
      requestAnimationFrame(() => toggleBtnRef.current?.focus());
    } else {
      setDrawerOpen((v) => !v);
    }
  };

  const isLarge = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1200px)').matches : true;
  const hamburgerExpanded = isLarge ? !collapsed : drawerOpen;
  const hamburgerLabel = isLarge ? (collapsed ? 'Expand navigation' : 'Collapse navigation') : (drawerOpen ? 'Close navigation' : 'Open navigation');

  const openDrawer = () => setDrawerOpen(true);

  // Topbar section context (longest-prefix match); breadcrumbs stay in <main>.
  const sectionContext = [...ADMIN_NAV]
    .sort((a, b) => b.to.length - a.to.length)
    .find((i) => location.pathname === i.to || location.pathname.startsWith(`${i.to}/`))
    ?? ADMIN_NAV[0];

  const shellClass = `admin-shell${collapsed ? ' admin-shell--collapsed' : ''}`;

  return (
    <div className={shellClass}>
      <aside className="admin-sidebar" aria-label="Admin navigation" id="admin-sidebar">
        <div className="admin-sidebar-top">
          {collapsed ? <RailNav onMore={openDrawer} /> : <GroupedNav />}
        </div>
        <SidebarIdentity />
      </aside>

      <div className="admin-main-col">
        {/* Topbar 64px: toggle + section context + primary-action slot */}
        <header className="admin-topbar">
          <button
            ref={toggleBtnRef}
            type="button"
            className="admin-menu-btn"
            aria-label={hamburgerLabel}
            aria-expanded={hamburgerExpanded}
            aria-controls="admin-sidebar"
            onClick={handleHamburger}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          <span aria-live="polite" style={{ fontSize: 'var(--m3-typescale-title-medium-size)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sectionContext?.label ?? 'Admin'}
          </span>
          <span style={{ flex: 1 }} aria-hidden="true" />
          <span data-slot="primary-action" style={{ display: 'inline-flex', alignItems: 'center' }} />
        </header>

        <main className="admin-main">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>

      {drawerOpen ? (
        <div
          className="admin-drawer-backdrop"
          style={{ display: 'block', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }}
          onClick={() => setDrawerOpen(false)}
          role="presentation"
        >
          <div
            ref={drawerRef}
            className="admin-drawer"
            style={{ background: 'var(--m3-surface-container-low)', width: 'min(360px, 86vw)', height: '100vh', padding: 12, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-drawer-head">
              <strong>GDG-CTU Admin</strong>
              <button type="button" aria-label="Close navigation" onClick={() => { setDrawerOpen(false); toggleBtnRef.current?.focus(); }}>✕</button>
            </div>
            <GroupedNav />
            <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--m3-outline-variant)' }}>
              <SidebarIdentity />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
