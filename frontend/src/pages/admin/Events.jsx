import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { eventsApi } from '../../api/resources.js';
import {
  ADMIN_ENTITY_ROUTES,
  adminNewTargetFor,
  timeAgo,
  useAdminList,
  useDebouncedValue,
} from '../../admin/editorial.js';
import { DataTable, DataTableColumnHeader } from '../../components/admin/data-table.jsx';
import { EmptyState, StatusPill, TypedConfirm } from '../../components/admin/shared.jsx';

function scopeOf(event) {
  const now = Date.now();
  const end = event?.endAt ?? event?.end_at ? new Date(event.endAt ?? event.end_at).getTime() : NaN;
  if (Number.isNaN(end)) return 'upcoming';
  return end < now ? 'past' : 'upcoming';
}

const SCOPES = [
  { value: 'all', label: 'All scopes' },
  { value: 'upcoming', label: 'Upcoming (endAt ≥ now)' },
  { value: 'past', label: 'Past (endAt < now)' },
];

/* 32px row-action targets — quiet bordered buttons, no extra card borders (DataTable owns the wrapper). */
const ACTION_LINK_CLASS =
  'inline-flex h-8 items-center px-3 rounded-[3px] border border-[#DFE1E6] bg-[#FAFBFC] text-sm font-medium text-[#42526E] hover:bg-[#EBECF0] hover:text-[#172B4D]';

/* Static column defs: title (detail link) · status badge · updated · scope · row actions. */
function useColumns({ onArchive }) {
  return useMemo(() => [
    {
      accessorKey: 'title',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
      cell: ({ row }) => {
        const event = row.original;
        // UUID preferred; `key` (id ?? slug) is for Links only — never for
        // api.get/update/remove, which require a UUID on /:id routes.
        const id = event?.id ?? event?._id ?? event?.uuid;
        const slug = event?.slug;
        const key = id ?? slug;
        if (!key) return <span className="font-medium">{event.title ?? '(untitled)'}</span>;
        return (
          <Link
            to={ADMIN_ENTITY_ROUTES.events.detail(key)}
            className="font-medium underline-offset-4 hover:underline"
          >
            {event.title ?? '(untitled)'}
          </Link>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => <StatusPill status={row.original.status} active={row.original.is_active} />,
    },
    {
      id: 'updated',
      accessorFn: (event) => event.updatedAt ?? event.updated_at ?? event.startAt ?? event.start_at ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Updated" />,
      cell: ({ row }) => {
        const event = row.original;
        return timeAgo(event.updatedAt ?? event.updated_at ?? event.startAt ?? event.start_at);
      },
    },
    {
      id: 'scope',
      accessorFn: (event) => scopeOf(event),
      header: 'Scope',
      enableSorting: false,
      cell: ({ row }) => <span className="capitalize">{scopeOf(row.original)}</span>,
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const event = row.original;
        const id = event?.id ?? event?._id ?? event?.uuid;
        const slug = event?.slug;
        const key = id ?? slug;
        // Archiving lives here on the row (the detail page has no archive
        // control). Hidden when neither id nor slug exists; UUID-only for
        // the archive call itself.
        if (!key) return <span className="admin-muted" aria-hidden="true">—</span>;
        const detail = ADMIN_ENTITY_ROUTES.events.detail(key);
        const label = event.title ?? '(untitled)';
        const archived = String(event.status ?? '').toLowerCase() === 'archived';
        return (
          <span className="admin-row-actions">
            <Link to={detail} className={ACTION_LINK_CLASS} aria-label={`Edit ${label}`}>
              Edit
            </Link>
            {!archived ? (
              <button
                type="button"
                className={`${ACTION_LINK_CLASS} admin-danger`}
                disabled={!id || id === 'undefined'}
                onClick={() => onArchive(event)}
                aria-label={`Archive ${label}`}
              >
                Archive
              </button>
            ) : null}
          </span>
        );
      },
    },
  ], [onArchive]);
}

export default function AdminEvents() {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const q = params.get('q') ?? '';
  const scope = params.get('scope') ?? 'all';
  const { data, loading, error, requestId, retry } = useAdminList(() => eventsApi.list(), 'events');
  const debounced = useDebouncedValue(q);
  // Row-archive state: confirm target, in-flight flag, toast + error banner,
  // and an optimistic override map (id → true) that marks the row archived
  // immediately and rolls back on failure — the TermDetail toggle pattern.
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [toast, setToast] = useState('');
  const [rowError, setRowError] = useState(null);
  const [optimisticArchived, setOptimisticArchived] = useState({});

  const columns = useColumns({ onArchive: setConfirmTarget });

  const rows = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    return (data ?? [])
      .map((e) => {
        const eid = e?.id ?? e?._id ?? e?.uuid;
        if (eid && optimisticArchived[eid]) return { ...e, status: 'archived', is_active: false };
        return e;
      })
      .filter((e) => {
        if (scope !== 'all' && scopeOf(e) !== scope) return false;
        if (!term) return true;
        return [e.title, e.slug, e.location].filter(Boolean).join(' ').toLowerCase().includes(term);
      });
  }, [data, debounced, scope, optimisticArchived]);

  // Overrides converge once fresh data arrives — never linger past a refetch.
  useEffect(() => {
    setOptimisticArchived({});
  }, [data]);

  const setQuery = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  const setScope = (value) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete('scope');
    else next.set('scope', value);
    setParams(next, { replace: true });
  };

  const runArchive = async () => {
    const target = confirmTarget;
    const eid = target?.id ?? target?._id ?? target?.uuid;
    if (!target || !eid || eid === 'undefined') {
      setConfirmTarget(null);
      return;
    }
    setConfirmTarget(null);
    setArchiving(true);
    setRowError(null);
    setOptimisticArchived((prev) => ({ ...prev, [eid]: true }));
    try {
      await eventsApi.update(eid, { isActive: false, status: 'archived' });
      setToast(`Archived “${target.title ?? '(untitled)'}”. Hidden publicly, still editable.`);
      retry();
    } catch (err) {
      setOptimisticArchived((prev) => {
        const next = { ...prev };
        delete next[eid];
        return next;
      });
      setRowError(err?.body?.message ?? err?.message ?? 'Archive failed — change reverted.');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <section aria-label="Events">
      <div className="admin-page-head">
        <div>
          <h1>Events</h1>
          <p className="admin-muted">Searchable table · ?scope=upcoming|past respected.</p>
        </div>
        <Link className="admin-new-btn" to={ADMIN_ENTITY_ROUTES.events.new}>+ New event</Link>
      </div>

      {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}
      {rowError ? <div className="admin-summary" role="alert"><p>{rowError}</p></div> : null}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        loadingLabel="Loading events…"
        error={error}
        onRetry={retry}
        searchColumnId="title"
        searchPlaceholder="Search events…"
        searchValue={q}
        onSearchChange={setQuery}
        scopes={SCOPES}
        scopeColumnId="scope"
        scopeValue={scope}
        onScopeChange={setScope}
        pageSizeOptions={[20, 10]}
        renderEmptyState={
          <EmptyState
            title={data.length === 0 ? 'No events yet' : 'No events match this filter'}
            hint="Create a draft event to get started. Publish only when the gate passes."
            actionLabel="+ New event"
            actionTo={adminNewTargetFor(pathname)}
          />
        }
      />
      {!loading && error && requestId ? (
        <p className="admin-muted">Request ID: {requestId}</p>
      ) : null}

      <TypedConfirm
        open={!!confirmTarget}
        title="Archive event?"
        body="Archive hides it publicly but keeps it editable and restorable (preferred over delete)."
        expected={confirmTarget?.title ?? ''}
        confirmLabel="Archive"
        busy={archiving}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={runArchive}
      />
    </section>
  );
}
