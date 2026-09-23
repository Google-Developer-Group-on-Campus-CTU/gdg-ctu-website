import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { albumsApi, albumItemsApi, getId } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, useAdminList, useDebouncedValue } from '../../admin/editorial.js';
import { AdminListPage, EmptyState, StatusPill } from '../../components/admin/shared.jsx';

export default function AdminGallery() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const debounced = useDebouncedValue(q);
  const albums = useAdminList(() => albumsApi.list().catch((e) => {
    if (e?.status === 404) return [];
    throw e;
  }), 'albums');
  const items = useAdminList(() => albumItemsApi.list().catch(() => []), 'album-items');

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
    if (!term) return albums.data ?? [];
    return (albums.data ?? []).filter((a) =>
      [a.title, a.slug].filter(Boolean).join(' ').toLowerCase().includes(term),
    );
  }, [albums.data, debounced]);

  const loading = albums.loading || items.loading;
  const error = albums.error;

  return (
    <section aria-label="Gallery albums">
      <div className="admin-page-head">
        <div>
          <h1>Gallery</h1>
          <p className="admin-muted">Manual albums + curated featured photos. Albums reuse media-collections.</p>
        </div>
        <Link className="gdg-btn gdg-btn-primary" to={ADMIN_ENTITY_ROUTES.gallery.new}>+ New album</Link>
      </div>
      <AdminListPage
        loading={loading}
        loadingLabel="Loading albums…"
        error={error}
        requestId={albums.requestId}
        onRetry={albums.retry}
        errorContext="load albums"
        isEmpty={rows.length === 0}
        empty={
          <EmptyState title="No albums yet" hint="Manually create an album, then add photos from the Media picker." actionLabel="+ New album" actionTo={ADMIN_ENTITY_ROUTES.gallery.new} />
        }
      >
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th scope="col">Title</th><th scope="col">Event link</th><th scope="col">Photos</th><th scope="col">Featured</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {rows.map((a) => {
                const id = getId(a) ?? a.slug;
                return (
                  <tr key={id}>
                    <td><Link to={ADMIN_ENTITY_ROUTES.gallery.detail(id)}>{a.title ?? '(untitled)'}</Link></td>
                    <td>{a.event_id ?? a.eventId ?? '—'}</td>
                    <td>{counts[id] ?? counts[a.id] ?? 0}</td>
                    <td>{a.is_featured ? '★' : '—'}</td>
                    <td><StatusPill status={a.status} active={a.is_active} /></td>
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
