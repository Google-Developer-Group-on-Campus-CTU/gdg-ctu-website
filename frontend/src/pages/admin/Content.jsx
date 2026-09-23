import { Link } from 'react-router-dom';
import { contentApi } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, CONTENT_KEYS } from '../../admin/editorial.js';
import { useAdminList } from '../../admin/editorial.js';
import { EmptyState, ErrorState, LoadingSkeleton, StatusPill } from '../../components/admin/shared.jsx';

export default function AdminContent() {
  const { data, loading, error, requestId, retry } = useAdminList(
    () => contentApi.list().catch((e) => {
      if (e?.status === 404) return [];
      throw e;
    }),
    'content',
  );
  const byKey = new Map((data ?? []).map((c) => [c.section_key ?? c.sectionKey, c]));

  return (
    <section aria-label="Site content">
      <div className="admin-page-head">
        <div>
          <h1>Site Content</h1>
          <p className="admin-muted">Fixed keys only — no custom keys in V1: {CONTENT_KEYS.join(', ')}.</p>
        </div>
      </div>
      {loading ? <LoadingSkeleton label="Loading content…" /> : null}
      {!loading && error ? <ErrorState error={error} requestId={requestId} onRetry={retry} context="load content" /> : null}
      {!loading && !error && (data ?? []).length === 0 ? (
        <EmptyState title="No content rows yet" hint="The backend returns one row per section key. Open a section to create its row." />
      ) : null}
      {!loading && !error ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th scope="col">Section</th><th scope="col">Title</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {CONTENT_KEYS.map((key) => {
                const row = byKey.get(key);
                return (
                  <tr key={key}>
                    <td><Link to={ADMIN_ENTITY_ROUTES.content.detail(key)}>{key}</Link></td>
                    <td>{row?.title ?? <span className="admin-muted">— not created —</span>}</td>
                    <td>{row ? <StatusPill status={row.status} active={row.is_active} /> : <span className="admin-muted">missing</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
