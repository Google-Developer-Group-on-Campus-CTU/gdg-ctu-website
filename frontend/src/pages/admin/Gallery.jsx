import { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { albumsApi, albumItemsApi } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, adminNewTargetFor, useAdminList, useDebouncedValue } from '../../admin/editorial.js';
import { DataTable, DataTableColumnHeader } from '../../components/admin/data-table.jsx';
import { EmptyState, StatusPill } from '../../components/admin/shared.jsx';

const ACTION_LINK_CLASS =
  'inline-flex h-10 items-center px-6 rounded-full border border-[var(--m3-outline)] bg-transparent text-[14px] font-medium tracking-[0.1px] text-[var(--m3-primary)] hover:bg-[rgba(11,87,208,0.08)]';

/* Static column defs: cover thumb · sortable title link · event link · photo counts · featured · status · manage. */
const columns = [
  {
    id: 'cover',
    header: 'Cover',
    enableSorting: false,
    cell: ({ row }) => {
      const album = row.original;
      const src = album.cover_url ?? album.coverUrl ?? '';
      const label = album.title ?? album.name ?? '(untitled)';
      return src ? (
        <img src={src} alt="" aria-label={`Cover of ${label}`} className="admin-thumb" loading="lazy" />
      ) : (
        <span className="admin-thumb" aria-hidden="true" />
      );
    },
  },
  {
    accessorKey: 'title',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
    cell: ({ row }) => {
      const album = row.original;
      // Albums use title (backend `name` maps to form `title`); `key`
      // (id ?? slug) is for Links only — data calls require the UUID.
      const id = album?.id ?? album?._id ?? album?.uuid;
      const slug = album?.slug;
      const key = id ?? slug;
      const label = album.title ?? album.name ?? '(untitled)';
      if (!key) return <span className="font-medium">{label}</span>;
      return (
        <Link
          to={ADMIN_ENTITY_ROUTES.gallery.detail(key)}
          className="font-medium underline-offset-4 hover:underline"
        >
          {label}
        </Link>
      );
    },
  },
  {
    id: 'event',
    accessorFn: (a) => a.event_id ?? a.eventId ?? '',
    header: 'Event link',
    enableSorting: false,
    cell: ({ row }) => row.original.event_id ?? row.original.eventId ?? '—',
  },
  {
    id: 'photos',
    accessorFn: (a) => a._photoCount ?? 0,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Photos" />,
    cell: ({ row }) => <span className="tabular-nums">{row.original._photoCount ?? 0}</span>,
  },
  {
    id: 'featured',
    accessorFn: (a) => (a.is_featured ? 1 : 0),
    header: 'Featured',
    enableSorting: false,
    cell: ({ row }) => (
      <span aria-label={row.original.is_featured ? 'Featured' : 'Not featured'}>
        {row.original.is_featured ? '★' : '—'}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => <StatusPill status={row.original.status} active={row.original.is_active} />,
  },
  {
    id: 'actions',
    header: 'Actions',
    enableSorting: false,
    cell: ({ row }) => {
      const album = row.original;
      const id = album?.id ?? album?._id ?? album?.uuid;
      const slug = album?.slug;
      const key = id ?? slug;
      // No standalone edit route: the detail page IS the editor (view+edit),
      // so a single Manage pill opens it. Hidden when neither id nor slug exists.
      if (!key) return <span className="admin-muted" aria-hidden="true">—</span>;
      const detail = ADMIN_ENTITY_ROUTES.gallery.detail(key);
      const label = album.title ?? album.name ?? '(untitled)';
      return (
        <Link to={detail} className={ACTION_LINK_CLASS} aria-label={`Manage ${label}`}>
          Manage
        </Link>
      );
    },
  },
];

export default function AdminGallery() {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const q = params.get('q') ?? '';
  const debounced = useDebouncedValue(q);
  const albums = useAdminList(() => albumsApi.list().catch((e) => {
    if (e?.status === 404) return [];
    throw e;
  }), 'albums');
  // No `.catch(() => [])`: a failed items list must surface via `items.error`
  // instead of rendering photo counts off an empty array.
  const items = useAdminList(() => albumItemsApi.list(), 'album-items');

  const counts = useMemo(() => {
    const map = {};
    for (const it of items.data ?? []) {
      const key = it.collection_id ?? it.collectionId ?? it.album_id ?? it.albumId;
      if (key) map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [items.data]);

  const rows = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    const withCounts = (albums.data ?? []).map((a) => {
      const id = a?.id ?? a?._id ?? a?.uuid;
      const slug = a?.slug;
      const key = id ?? slug;
      return { ...a, _photoCount: (key ? counts[key] : undefined) ?? counts[a.id] ?? 0 };
    });
    if (!term) return withCounts;
    return withCounts.filter((a) =>
      [a.title ?? a.name, a.slug].filter(Boolean).join(' ').toLowerCase().includes(term),
    );
  }, [albums.data, counts, debounced]);

  const setQuery = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  // Retry both loaders: album rows and photo counts come from different lists.
  const retryAll = () => {
    albums.retry();
    items.retry();
  };

  const loading = albums.loading || items.loading;
  const error = albums.error ?? items.error;

  return (
    <section aria-label="Gallery albums">
      <div className="admin-page-head">
        <div>
          <h1>Gallery</h1>
          <p className="admin-muted">Manual albums + curated featured photos. Albums reuse media-collections.</p>
        </div>
        <Link className="admin-new-btn" to={ADMIN_ENTITY_ROUTES.gallery.new}>+ New album</Link>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        loadingLabel="Loading albums…"
        error={error}
        requestId={albums.requestId ?? items.requestId}
        onRetry={retryAll}
        searchColumnId="title"
        searchPlaceholder="Search albums…"
        searchValue={q}
        onSearchChange={setQuery}
        pageSizeOptions={[20, 10]}
        renderEmptyState={
          <EmptyState
            title={(albums.data ?? []).length === 0 ? 'No albums yet' : 'No albums match this filter'}
            hint="Manually create an album, then add photos from the Media picker."
            actionLabel="+ New album"
            actionTo={adminNewTargetFor(pathname)}
          />
        }
      />
    </section>
  );
}
