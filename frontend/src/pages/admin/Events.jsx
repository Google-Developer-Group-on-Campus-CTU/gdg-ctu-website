import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { eventsApi, getId } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, timeAgo, useAdminList, useDebouncedValue } from '../../admin/editorial.js';
import { AdminListPage, EmptyState, StatusPill } from '../../components/admin/shared.jsx';

function scopeOf(event) {
  const now = Date.now();
  const end = event?.endAt ?? event?.end_at ? new Date(event.endAt ?? event.end_at).getTime() : NaN;
  const published = String(event?.status ?? '').toLowerCase() === 'published';
  if (event?.is_featured && published) return 'featured';
  if (Number.isNaN(end)) return 'upcoming';
  return end < now ? 'past' : 'upcoming';
}

export default function AdminEvents() {
  const [params, setParams] = useSearchParams();
  const [activeToggles, setActiveToggles] = useState({});
  const q = params.get('q') ?? '';
  const scope = params.get('scope') ?? 'all';
  const { data, loading, error, requestId, retry } = useAdminList(() => eventsApi.list(), 'events');
  const debounced = useDebouncedValue(q);

  const rows = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    return (data ?? []).filter((e) => {
      if (scope !== 'all' && scopeOf(e) !== scope) return false;
      if (!term) return true;
      return [e.title, e.slug, e.location].filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [data, debounced, scope]);

  const setScope = (value) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete('scope');
    else next.set('scope', value);
    setParams(next, { replace: true });
  };

  const toggleActive = async (event) => {
    const id = getId(event);
    const optimistic = !(event.is_active ?? true);
    setActiveToggles((m) => ({ ...m, [id]: optimistic }));
    try {
      await eventsApi.update(id, { is_active: optimistic });
    } catch {
      setActiveToggles((m) => ({ ...m, [id]: event.is_active ?? true }));
    }
  };

  return (
    <section aria-label="Events">
      <div className="admin-page-head">
        <div>
          <h1>Events</h1>
          <p className="admin-muted">Searchable table · ?scope=upcoming|past|featured respected.</p>
        </div>
        <Link className="gdg-btn gdg-btn-primary" to={ADMIN_ENTITY_ROUTES.events.new}>+ New event</Link>
      </div>

      <div className="admin-toolbar">
        <label className="admin-visually-hidden" htmlFor="event-scope">Filter by scope</label>
        <select id="event-scope" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="all">All scopes</option>
          <option value="upcoming">Upcoming (endAt ≥ now)</option>
          <option value="past">Past (endAt &lt; now)</option>
          <option value="featured">Featured (published + flagged)</option>
        </select>
        <span className="admin-muted" aria-live="polite">{rows.length} result(s)</span>
      </div>

      <AdminListPage
        loading={loading}
        loadingLabel="Loading events…"
        error={error}
        requestId={requestId}
        onRetry={retry}
        errorContext="load events"
        isEmpty={rows.length === 0}
        empty={
          <EmptyState
            title={data.length === 0 ? 'No events yet' : 'No events match this filter'}
            hint="Create a draft event to get started. Publish only when the gate passes."
            actionLabel="+ New event"
            actionTo={ADMIN_ENTITY_ROUTES.events.new}
          />
        }
      >
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Cover</th>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Start</th>
                <th scope="col">Order</th>
                <th scope="col">Active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => {
                const id = getId(event) ?? event.slug;
                const active = activeToggles[id] ?? event.is_active ?? true;
                return (
                  <tr key={id}>
                    <td>
                      {event.cover_url ?? event.coverUrl ? (
                        <img className="admin-thumb" src={event.cover_url ?? event.coverUrl} alt="" />
                      ) : (
                        <span className="admin-muted">—</span>
                      )}
                    </td>
                    <td><Link to={ADMIN_ENTITY_ROUTES.events.detail(id)}>{event.title ?? '(untitled)'}</Link></td>
                    <td><StatusPill status={event.status} active={active} /></td>
                    <td>{timeAgo(event.startAt ?? event.start_at)}</td>
                    <td>{event.display_order ?? 0}</td>
                    <td>
                      <label>
                        <input
                          type="checkbox"
                          checked={!!active}
                          onChange={() => toggleActive(event)}
                          aria-label={`Active toggle for ${event.title}`}
                        />{' '}
                        {active ? 'on' : 'off'}
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </AdminListPage>
    </section>
  );
}
