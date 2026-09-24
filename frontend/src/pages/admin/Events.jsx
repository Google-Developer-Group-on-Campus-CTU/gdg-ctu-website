import { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { eventsApi, getId } from '../../api/resources.js';
import {
  ADMIN_ENTITY_ROUTES,
  adminNewTargetFor,
  timeAgo,
  useAdminList,
  useDebouncedValue,
} from '../../admin/editorial.js';
import { DataTable, DataTableColumnHeader } from '../../components/admin/data-table.jsx';
import { EmptyState, StatusPill } from '../../components/admin/shared.jsx';

function scopeOf(event) {
  const now = Date.now();
  const end = event?.endAt ?? event?.end_at ? new Date(event.endAt ?? event.end_at).getTime() : NaN;
  const published = String(event?.status ?? '').toLowerCase() === 'published';
  if (event?.is_featured && published) return 'featured';
  if (Number.isNaN(end)) return 'upcoming';
  return end < now ? 'past' : 'upcoming';
}

const SCOPES = [
  { value: 'all', label: 'All scopes' },
  { value: 'upcoming', label: 'Upcoming (endAt ≥ now)' },
  { value: 'past', label: 'Past (endAt < now)' },
  { value: 'featured', label: 'Featured (published + flagged)' },
];

/* 32px row-action targets — quiet bordered buttons, no extra card borders (DataTable owns the wrapper). */
const ACTION_LINK_CLASS =
  'inline-flex h-8 items-center px-3 rounded-[3px] border border-[#DFE1E6] bg-[#FAFBFC] text-sm font-medium text-[#42526E] hover:bg-[#EBECF0] hover:text-[#172B4D]';

/* Static column defs: title (detail link) · status badge · updated · scope · row actions. */
const columns = [
  {
    accessorKey: 'title',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
    cell: ({ row }) => {
      const event = row.original;
      const id = getId(event) ?? event.slug;
      return (
        <Link
          to={ADMIN_ENTITY_ROUTES.events.detail(id)}
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
      const id = getId(event) ?? event.slug;
      // No standalone edit route: the detail page IS the editor (view+edit),
      // so a single Manage pill opens it.
      const detail = ADMIN_ENTITY_ROUTES.events.detail(id);
      const label = event.title ?? '(untitled)';
      return (
        <Link to={detail} className={ACTION_LINK_CLASS} aria-label={`Manage ${label}`}>
          Manage
        </Link>
      );
    },
  },
];

export default function AdminEvents() {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
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

  return (
    <section aria-label="Events">
      <div className="admin-page-head">
        <div>
          <h1>Events</h1>
          <p className="admin-muted">Searchable table · ?scope=upcoming|past|featured respected.</p>
        </div>
        <Link className="admin-new-btn" to={ADMIN_ENTITY_ROUTES.events.new}>+ New event</Link>
      </div>

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
    </section>
  );
}
