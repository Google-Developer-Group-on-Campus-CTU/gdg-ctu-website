import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { contentApi } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, CONTENT_KEYS } from '../../admin/editorial.js';
import { useAdminList, useDebouncedValue } from '../../admin/editorial.js';
import { DataTable, DataTableColumnHeader } from '../../components/admin/data-table.jsx';
import { EmptyState, StatusPill } from '../../components/admin/shared.jsx';

/* 32px row-action targets — quiet bordered buttons, no extra card borders (DataTable owns the wrapper). */
const ACTION_LINK_CLASS =
  'inline-flex h-8 items-center px-3 rounded-[3px] border border-[#DFE1E6] bg-[#FAFBFC] text-sm font-medium text-[#42526E] hover:bg-[#EBECF0] hover:text-[#172B4D]';

/* Static column defs: sectionKey link · title · status · manage. Rows are
   fixed CONTENT_KEYS entries (some may not exist on the backend yet). */
const columns = [
  {
    accessorKey: 'key',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Section" />,
    cell: ({ row }) => (
      <Link
        to={ADMIN_ENTITY_ROUTES.content.detail(row.original.key)}
        className="font-medium underline-offset-4 hover:underline"
      >
        {row.original.key}
      </Link>
    ),
  },
  {
    id: 'title',
    accessorFn: (entry) => entry.row?.title ?? '',
    header: 'Title',
    enableSorting: false,
    cell: ({ row }) => (
      row.original.row?.title ?? <span className="admin-muted">— not created —</span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => (
      row.original.row
        ? <StatusPill status={row.original.row.status} active={row.original.row.is_active} />
        : <span className="admin-muted">missing</span>
    ),
  },
  {
    id: 'actions',
    header: 'Actions',
    enableSorting: false,
    cell: ({ row }) => {
      // The detail editor creates the row on first save — Manage opens it
      // whether or not the backend row exists yet.
      const detail = ADMIN_ENTITY_ROUTES.content.detail(row.original.key);
      return (
        <Link to={detail} className={ACTION_LINK_CLASS} aria-label={`Manage ${row.original.key} section`}>
          Manage
        </Link>
      );
    },
  },
];

export default function AdminContent() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const debounced = useDebouncedValue(q);
  const { data, loading, error, requestId, retry } = useAdminList(
    () => contentApi.list().catch((e) => {
      if (e?.status === 404) return [];
      throw e;
    }),
    'content',
  );

  const entries = useMemo(() => {
    const byKey = new Map((data ?? []).map((c) => [c.section_key ?? c.sectionKey, c]));
    const term = debounced.trim().toLowerCase();
    return CONTENT_KEYS
      .map((key) => ({ key, row: byKey.get(key) }))
      .filter((entry) => {
        if (!term) return true;
        return [entry.key, entry.row?.title].filter(Boolean).join(' ').toLowerCase().includes(term);
      });
  }, [data, debounced]);

  const setQuery = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  return (
    <section aria-label="Site content">
      <div className="admin-page-head">
        <div>
          <h1>Site Content</h1>
          <p className="admin-muted">Fixed keys only — no custom keys in V1: {CONTENT_KEYS.join(', ')}.</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={entries}
        loading={loading}
        loadingLabel="Loading content…"
        error={error}
        requestId={requestId}
        onRetry={retry}
        searchColumnId="key"
        searchPlaceholder="Search sections…"
        searchValue={q}
        onSearchChange={setQuery}
        pageSizeOptions={[20, 10]}
        renderEmptyState={
          <EmptyState
            title={q ? `No sections match “${q}”.` : 'No content rows yet'}
            hint="The backend returns one row per section key. Open a section to create its row."
          />
        }
      />
    </section>
  );
}
