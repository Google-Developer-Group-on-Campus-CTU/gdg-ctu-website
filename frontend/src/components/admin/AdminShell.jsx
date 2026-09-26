import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Users, Handshake, Images, GalleryHorizontal, Inbox, Settings, LogOut, MoreHorizontal, Moon, Sun, Menu, X } from 'lucide-react';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import { authClient } from '../../lib/auth-client';
import { ADMIN_ENTITY_ROUTES } from '../../admin/editorial.js';
import { AdminMuiProvider, useAdminThemeMode } from './mui-theme.jsx';
import '../../styles/admin.css';

const NAV_ICONS = {
  '/admin': LayoutDashboard,
  '/admin/events': CalendarDays,
  '/admin/team': Users,
  '/admin/partners': Handshake,
  '/admin/gallery': Images,
  '/admin/media': GalleryHorizontal,
  '/admin/messages': Inbox,
  '/admin/users': Users,
  '/admin/settings': Settings,
};

export const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', end: true, kind: 'dashboard' },
  ...Object.values(ADMIN_ENTITY_ROUTES).map((entity) => ({ to: entity.list, label: entity.label, kind: 'entity' })),
  { to: '/admin/users', label: 'Users', kind: 'system' },
  { to: '/admin/settings', label: 'Settings', kind: 'system' },
];

const STORAGE_KEY = 'm3-admin-sidebar-collapsed';

// Spec §3.3 grouped drawer (10 destinations in 3 groups). Derived from
// ADMIN_NAV by path so labels/routes stay in sync with ADMIN_ENTITY_ROUTES.
const NAV_GROUPS = [
  { heading: 'Overview', tos: ['/admin'] },
  { heading: 'Content', tos: ['/admin/events', '/admin/team', '/admin/partners', '/admin/gallery', '/admin/messages'] },
  { heading: 'System', tos: ['/admin/media', '/admin/users', '/admin/settings'] },
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

/** Admin-only light/dark toggle (MUI theme mode, persisted). Public site unaffected. */
function AdminThemeToggle() {
  const { mode, toggleMode } = useAdminThemeMode();
  const dark = mode === 'dark';
  const handleClick = (e) => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Circular clip-path wipe from the button center; instant swap fallback
    // without the API or under reduced motion. flushSync commits the mode
    // synchronously so the transition captures the new frame (React batches
    // otherwise and the wipe would reveal an unchanged snapshot).
    if (
      !reduceMotion &&
      typeof document !== 'undefined' &&
      typeof document.startViewTransition === 'function'
    ) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const maxRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );
      try {
        const transition = document.startViewTransition(() => {
          flushSync(() => toggleMode());
        });
        // Wait for the new snapshot before driving the wipe; animating
        // synchronously can miss the ::view-transition-new(root) pseudo.
        // Fallback inside .catch: the mode swap already committed, so a
        // rejected/aborted transition still leaves a correct instant swap.
        const runWipe = () => {
          document.documentElement.animate(
            {
              clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${maxRadius}px at ${x}px ${y}px)`],
            },
            {
              duration: 450,
              easing: 'ease-out',
              pseudoElement: '::view-transition-new(root)',
            },
          );
        };
        if (transition?.ready) {
          transition.ready.then(runWipe).catch(() => {});
        } else {
          runWipe();
        }
      } catch {
        toggleMode();
      }
      return;
    }
    toggleMode();
  };
  return (
    <IconButton
      type="button"
      onClick={handleClick}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      sx={{ color: 'var(--m3-on-surface-variant)' }}
    >
      {dark ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
    </IconButton>
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
      <Button
        type="button"
        variant="text"
        size="small"
        startIcon={<LogOut size={18} aria-hidden="true" />}
        onClick={handleSignOut}
        aria-label="Sign out"
        sx={{ mt: 1 }}
      >
        Sign out
      </Button>
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
  const toggleBtnRef = useRef(null);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)); } catch {}
  }, [collapsed]);

  // Modal drawer focus trap, Esc, backdrop-close, and scroll lock all come
  // from MUI Drawer (temporary variant) — no hand-rolled keydown/scroll code.

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
    <AdminMuiProvider>
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
          <IconButton
            ref={toggleBtnRef}
            type="button"
            aria-label={hamburgerLabel}
            aria-expanded={hamburgerExpanded}
            aria-controls="admin-sidebar"
            onClick={handleHamburger}
            sx={{ color: 'var(--m3-on-surface-variant)' }}
          >
            <Menu size={24} aria-hidden="true" />
          </IconButton>
          <span aria-live="polite" style={{ fontSize: 'var(--m3-typescale-title-medium-size)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sectionContext?.label ?? 'Admin'}
          </span>
          <span style={{ flex: 1 }} aria-hidden="true" />
          <AdminThemeToggle />
          <span data-slot="primary-action" style={{ display: 'inline-flex', alignItems: 'center' }} />
        </header>

        <main className="admin-main">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>

      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        aria-label="Admin navigation"
        PaperProps={{
          sx: {
            background: 'var(--m3-surface-container-low)',
            width: 'min(360px, 86vw)',
            padding: 1.5,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          },
        }}
      >
        <div className="admin-drawer-head">
          <strong>GDG-CTU Admin</strong>
          <IconButton type="button" size="small" aria-label="Close navigation" onClick={() => { setDrawerOpen(false); toggleBtnRef.current?.focus(); }}>
            <X size={20} aria-hidden="true" />
          </IconButton>
        </div>
        <GroupedNav />
        <div style={{ marginTop: 'auto', paddingTop: 16, borderTop: '1px solid var(--m3-outline-variant)' }}>
          <SidebarIdentity />
        </div>
      </Drawer>
    </div>
    </AdminMuiProvider>
  );
}
