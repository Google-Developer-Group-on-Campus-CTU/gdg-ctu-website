import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { albumsApi, contentApi, eventsApi, getId, getStatus, getUpdatedAt, mediaApi, partnersApi, teamApi } from '../../api/resources.js';
import { toArray } from '../../api/resources.js';
import { adminDetailPathFor, adminItemLabel, timeAgo } from '../../admin/editorial.js';
import { ErrorState, LoadingSkeleton, StatusPill } from '../../components/admin/shared.jsx';
import { authClient } from '../../lib/auth-client';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [drafts, setDrafts] = useState([]);
  const [recent, setRecent] = useState([]);
  const { data: session } = authClient.useSession();
  const authed = !!session?.user;

  useEffect(() => {
    // Never fire the six protected endpoints without a live session — an
    // unauthenticated mount used to spray a batch of 401s (× StrictMode
    // remounts) that nothing redirected away.
    if (!authed) return undefined;
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
        contentApi.list().then(toArray).catch((e) => {
          if (e?.status === 404) return [];
          throw e;
        }),
        mediaApi.list({ limit: 20 }).then(toArray).catch(() => []),
      ]);
      const [events, team, partners, albums, content] = settled.map((r) =>
        r.status === 'fulfilled' ? r.value : [],
      );
      const failed = settled.find((r) => r.status === 'rejected' && r.reason?.status !== 404);
      if (failed && events.length === 0 && team.length === 0) throw failed.reason;
      const tagged = [
        ...events.map((i) => ({ kind: 'events', item: i })),
        ...team.map((i) => ({ kind: 'team', item: i })),
        ...partners.map((i) => ({ kind: 'partners', item: i })),
        ...albums.map((i) => ({ kind: 'gallery', item: i })),
        ...content.map((i) => ({ kind: 'content', item: i })),
      ];
      const needPublish = tagged.filter(({ item }) => getStatus(item) === 'draft');
      const edited = [...tagged].sort(
        (a, b) => new Date(getUpdatedAt(b.item) ?? 0) - new Date(getUpdatedAt(a.item) ?? 0),
      ).slice(0, 8);
      if (alive) {
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
  }, [authed, retryCount]);

  // Unauthenticated: render nothing (a guard above redirects to login).
  if (!authed) return null;

  if (loading) {
    return (
      <section aria-label="Dashboard">
        <h1>Dashboard</h1>
        <LoadingSkeleton label="Loading dashboard…" />
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
          <h1>Dashboard</h1>
          <p className="admin-muted">MVP slice: drafts needing publish + recent edits only.</p>
        </div>
      </div>
      <div className="admin-cards">
        <article className="admin-card" aria-label="Drafts needing publish">
          <h2>Drafts needing publish ({drafts.length})</h2>
          {drafts.length === 0 ? (
            <p className="admin-muted">Nothing waiting. Create a draft from any section.</p>
          ) : (
            <ul>
              {drafts.map(({ kind, item }, i) => (
                <li key={`${kind}-${getId(item) ?? adminItemLabel(item, `draft-${i}`)}`}>
                  <Link to={adminDetailPathFor(kind, item)}>{adminItemLabel(item)}</Link>{' '}
                  <StatusPill status={getStatus(item)} active={item?.is_active} />{' '}
                  <span className="admin-muted">{kind} · {timeAgo(getUpdatedAt(item))}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="admin-card" aria-label="Recent edits">
          <h2>Recent edits</h2>
          {recent.length === 0 ? (
            <p className="admin-muted">No edits yet.</p>
          ) : (
            <ul>
              {recent.map(({ kind, item }, i) => (
                <li key={`r-${kind}-${getId(item) ?? adminItemLabel(item, `recent-${i}`)}`}>
                  <Link to={adminDetailPathFor(kind, item)}>{adminItemLabel(item)}</Link>{' '}
                  <span className="admin-muted">
                    {kind} · edited {timeAgo(getUpdatedAt(item))}
                    {item?.updated_by ? ` by ${item.updated_by}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
