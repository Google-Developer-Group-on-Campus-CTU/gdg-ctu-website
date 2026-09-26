import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { albumsApi, eventsApi, getStatus, getUpdatedAt, mediaApi, partnersApi, teamApi } from '../../api/resources.js';
import { toArray } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, adminDetailPathFor, adminItemLabel, timeAgo } from '../../admin/editorial.js';
import { EditorCard } from '../../components/admin/form-shell.jsx';
import { ErrorState, LoadingSkeleton, StatusPill } from '../../components/admin/shared.jsx';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Skeleton from '@mui/material/Skeleton';
import { authClient } from '../../lib/auth-client';

const WRAPPER_CLASS =
  'overflow-hidden rounded-[12px] border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container-lowest)]';

/* Stat strip: one pill per section (red/blue/green/yellow), each linking its
   filtered list with total + draft/hidden splits. */
const STAT_SECTIONS = [
  { kind: 'events', label: 'Events', className: 'admin-stat--red' },
  { kind: 'team', label: 'Team', className: 'admin-stat--blue' },
  { kind: 'partners', label: 'Partners', className: 'admin-stat--green' },
  { kind: 'gallery', label: 'Gallery', className: 'admin-stat--yellow' },
];

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [drafts, setDrafts] = useState([]);
  const [recent, setRecent] = useState([]);
  const [stats, setStats] = useState([]);
  const { data: session, isPending } = authClient.useSession();
  const authed = !!session?.user;

  useEffect(() => {
    // Wait for the session check before deciding: firing the four protected
    // endpoints while `isPending` sprayed 401s (× StrictMode remounts) that
    // nothing redirected away. Unauthenticated mounts still never fetch.
    if (isPending || !authed) return undefined;
    let alive = true;
    const rid = `dash-${Date.now().toString(36)}`;
    setLoading(true);
    setError(null);
    setRequestId(rid);
    (async () => {
      const settled = await Promise.allSettled([
        eventsApi.list().then(toArray),
        teamApi.list().then(toArray),
        partnersApi.list().then(toArray).catch((e) => {
          if (e?.status === 404) return [];
          throw e;
        }),
        albumsApi.list().then(toArray).catch((e) => {
          if (e?.status === 404) return [];
          throw e;
        }),
        mediaApi.list({ limit: 20 }).then(toArray).catch((e) => {
          if (e?.status === 404) return [];
          throw e;
        }),
      ]);
      // Any non-404 list failure surfaces the error state — never render an
      // empty dashboard off a failed request (404 = module not shipped = empty).
      const failed = settled.find((r) => r.status === 'rejected' && r.reason?.status !== 404);
      if (failed) throw failed.reason;
      const [events, team, partners, albums] = settled.map((r) =>
        r.status === 'fulfilled' ? r.value : [],
      );
      const tagged = [
        ...events.map((i) => ({ kind: 'events', item: i })),
        ...team.map((i) => ({ kind: 'team', item: i })),
        ...partners.map((i) => ({ kind: 'partners', item: i })),
        ...albums.map((i) => ({ kind: 'gallery', item: i })),
      ];
      const needPublish = tagged.filter(({ item }) => getStatus(item) === 'draft');
      const edited = [...tagged].sort(
        (a, b) => new Date(getUpdatedAt(b.item) ?? 0) - new Date(getUpdatedAt(a.item) ?? 0),
      ).slice(0, 8);
      if (alive) {
        setStats(
          STAT_SECTIONS.map(({ kind, label, className }) => {
            const items = tagged.filter((t) => t.kind === kind).map((t) => t.item);
            return {
              kind,
              label,
              className,
              to: ADMIN_ENTITY_ROUTES[kind].list,
              total: items.length,
              drafts: items.filter((i) => getStatus(i) === 'draft').length,
              hidden: items.filter((i) => i?.is_active === false).length,
            };
          }),
        );
        setDrafts(needPublish.slice(0, 8));
        setRecent(edited);
        setLoading(false);
      }
    })().catch((err) => {
      if (alive) {
        setError(err);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [authed, isPending, retryCount]);

  // Session check still running: show the loader (not a blank null) so the
  // guard above has a settled verdict before we fetch or redirect.
  if (isPending) {
    return (
      <section aria-label="Dashboard">
        <h1>Dashboard</h1>
        <LoadingSkeleton label="Checking your session…" />
      </section>
    );
  }

  // Unauthenticated: render nothing (a guard above redirects to login).
  if (!authed) return null;

  if (loading) {
    return (
      <section aria-label="Dashboard">
        <div className="admin-page-head">
          <div>
            <p className="admin-eyebrow">Overview</p>
            <h1>Dashboard</h1>
          </div>
        </div>
        <Card className={WRAPPER_CLASS}>
          <CardContent>
            <div className="admin-skeleton-pad" role="status" aria-label="Loading dashboard…">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} variant="rounded" width="100%" height={20} aria-hidden="true" />
              ))}
              <span className="admin-visually-hidden">Loading dashboard…</span>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-label="Dashboard">
        <h1>Dashboard</h1>
        <ErrorState error={error} requestId={requestId} onRetry={() => setRetryCount((n) => n + 1)} context="load the dashboard" />
      </section>
    );
  }

  return (
    <section aria-label="Dashboard">
      <div className="admin-page-head">
        <div>
          <p className="admin-eyebrow">Overview</p>
          <h1>Dashboard</h1>
          <p className="admin-muted">MVP slice: drafts needing publish + recent edits only.</p>
        </div>
      </div>
      <ul className="admin-stats" aria-label="Section totals">
        {stats.map((s) => (
          <li key={s.kind}>
            <Link to={s.to} className={`admin-stat ${s.className}`}>
              <span className="admin-stat-number">{s.total}</span>
              <span className="admin-stat-label">{s.label}</span>
              <StatusPill status={s.drafts > 0 ? 'warning' : 'published'} />
              <span className="admin-muted">{s.drafts} drafts · {s.hidden} hidden</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="admin-cards">
        <EditorCard title={`Drafts needing publish (${drafts.length})`} eyebrow="Needs attention">
          {drafts.length === 0 ? (
            <p className="admin-muted">Nothing waiting. Create a draft from any section.</p>
          ) : (
            <ul>
              {drafts.map(({ kind, item }, i) => (
                <li key={`${kind}-${item?.id ?? item?._id ?? item?.uuid ?? item?.slug ?? adminItemLabel(item, `draft-${i}`)}`}>
                  <Link to={adminDetailPathFor(kind, item)}>{adminItemLabel(item)}</Link>{' '}
                  <StatusPill status={getStatus(item)} active={item?.is_active} />{' '}
                  <span className="admin-muted">{kind} · {timeAgo(getUpdatedAt(item))}</span>
                </li>
              ))}
            </ul>
          )}
        </EditorCard>
        <EditorCard title="Recent edits" eyebrow="Activity">
          {recent.length === 0 ? (
            <p className="admin-muted">No edits yet.</p>
          ) : (
            <ul>
              {recent.map(({ kind, item }, i) => (
                <li key={`r-${kind}-${item?.id ?? item?._id ?? item?.uuid ?? item?.slug ?? adminItemLabel(item, `recent-${i}`)}`}>
                  <Link to={adminDetailPathFor(kind, item)}>{adminItemLabel(item)}</Link>{' '}
                  <span className="admin-muted">
                    {kind} · edited {timeAgo(getUpdatedAt(item))}
                    {item?.updated_by ? ` by ${item.updated_by}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </EditorCard>
      </div>
    </section>
  );
}
