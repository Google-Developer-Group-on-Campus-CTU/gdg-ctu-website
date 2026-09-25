import { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { termsApi } from '../../api/resources.js';
import {
  ADMIN_ENTITY_ROUTES,
  adminNewTargetFor,
  useAdminList,
  useDebouncedValue,
} from '../../admin/editorial.js';
import { DataTable, DataTableColumnHeader } from '../../components/admin/data-table.jsx';
import { EmptyState } from '../../components/admin/shared.jsx';

/* 32px row-action targets — quiet bordered buttons, no extra card borders (DataTable owns the wrapper). */
const ACTION_LINK_CLASS =
  'inline-flex h-8 items-center px-3 rounded-[3px] border border-[#DFE1E6] bg-[#FAFBFC] text-sm font-medium text-[#42526E] hover:bg-[#EBECF0] hover:text-[#172B4D]';

function termDate(value) {
  if (!value) return '—';
  const text = String(value).slice(0, 10);
  return text || '—';
}

/* Static column defs: name (detail link, sortable) · dates · current · manage. */
const columns = [
  {
    id: 'name',
    accessorFn: (t) => t.name ?? '',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Term" />,
    cell: ({ row }) => {
      const term = row.original;
      const id = term?.id ?? term?._id ?? term?.uuid;
      const label = term.name ?? '(unnamed)';
      if (!id) return <span className="font-medium">{label}</span>;
      return (
        <Link
          to={ADMIN_ENTITY_ROUTES.terms.detail(id)}
          className="font-medium underline-offset-4 hover:underline"
        >
          {label}
        </Link>
      );
    },
  },
  {
    id: 'startDate',
    accessorFn: (t) => t.startDate ?? t.start_date ?? '',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Start" />,
    cell: ({ row }) => termDate(row.original.startDate ?? row.original.start_date),
  },
  {
    id: 'endDate',
    accessorFn: (t) => t.endDate ?? t.end_date ?? '',
    header: ({ column }) => <DataTableColumnHeader column={column} title="End" />,
    cell: ({ row }) => termDate(row.original.endDate ?? row.original.end_date),
  },
  {
    id: 'current',
    accessorFn: (t) => (t.isCurrent ?? t.is_current ? 1 : 0),
    header: 'Current',
    enableSorting: false,
    cell: ({ row }) => (
      (row.original.isCurrent ?? row.original.is_current) ? (
        <span className="lozenge lozenge-default">Current</span>
      ) : (
        <span className="admin-muted">—</span>
      )
    ),
  },
  {
    id: 'actions',
    header: 'Actions',
    enableSorting: false,
    cell: ({ row }) => {
      const term = row.original;
      const id = term?.id ?? term?._id ?? term?.uuid;
      // No standalone edit route: the detail page IS the editor (view+edit),
      // so a single Manage pill opens it. Hidden when no id exists.
      if (!id) return <span className="admin-muted" aria-hidden="true">—</span>;
      const detail = ADMIN_ENTITY_ROUTES.terms.detail(id);
      const label = term.name ?? '(unnamed)';
      return (
        <Link to={detail} className={ACTION_LINK_CLASS} aria-label={`Manage ${label}`}>
          Manage
        </Link>
      );
    },
  },
];

export default function AdminTerms() {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const q = params.get('q') ?? '';
  const debounced = useDebouncedValue(q);
  const { data, loading, error, requestId, retry } = useAdminList(
    () => termsApi.list().catch((e) => {
      if (e?.status === 404) return [];
      throw e;
    }),
    'terms',
  );

  const rows = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    const sorted = [...(data ?? [])].sort(
      (a, b) => String(b.startDate ?? b.start_date ?? '').localeCompare(String(a.startDate ?? a.start_date ?? '')),
    );
    if (!term) return sorted;
    return sorted.filter((t) => [t.name].filter(Boolean).join(' ').toLowerCase().includes(term));
  }, [data, debounced]);

  const setQuery = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  return (
    <section aria-label="Terms">
      <div className="admin-page-head">
        <div>
          <h1>Terms</h1>
          <p className="admin-muted">Academic terms own the date range; the roster lives on each term&apos;s detail page.</p>
        </div>
        <Link className="admin-new-btn" to={ADMIN_ENTITY_ROUTES.terms.new}>+ New term</Link>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        loadingLabel="Loading terms…"
        error={error}
        requestId={requestId}
        onRetry={retry}
        searchColumnId="name"
        searchPlaceholder="Search terms…"
        searchValue={q}
        onSearchChange={setQuery}
        pageSizeOptions={[20, 10]}
        renderEmptyState={
          <EmptyState
            title={data.length === 0 ? 'No terms yet' : 'No terms match this filter'}
            hint="Create the first term, then assign members to its roster."
            actionLabel="+ New term"
            actionTo={adminNewTargetFor(pathname)}
          />
        }
      />
    </section>
  );
}
