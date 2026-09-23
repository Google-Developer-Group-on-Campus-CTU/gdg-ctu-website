import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getId, partnersApi } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, useAdminList, useDebouncedValue } from '../../admin/editorial.js';
import { EmptyState, ErrorState, LoadingSkeleton, StatusPill } from '../../components/admin/shared.jsx';

const TIER_ORDER = { platinum: 0, gold: 1, silver: 2, community: 3 };

export default function AdminPartners() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const tier = params.get('tier') ?? 'all';
  const debounced = useDebouncedValue(q);
  const { data, loading, error, requestId, retry } = useAdminList(
    () => partnersApi.list().catch((e) => {
      if (e?.status === 404) return [];
      throw e;
    }),
    'partners',
  );

  const rows = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    return (data ?? [])
      .filter((p) => (tier === 'all' ? true : (p.tier ?? '') === tier))
      .filter((p) => (!term ? true : [p.name, p.slug].filter(Boolean).join(' ').toLowerCase().includes(term)))
      .sort((a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9) || (a.display_order ?? 0) - (b.display_order ?? 0));
  }, [data, debounced, tier]);

  const missing = !loading && !error && (data ?? []).length === 0;

  return (
    <section aria-label="Partners">
      <div className="admin-page-head">
        <div>
          <h1>Partners</h1>
          <p className="admin-muted">Grouped by tier · ordered by tier then display_order.</p>
        </div>
        <Link className="gdg-btn gdg-btn-primary" to={ADMIN_ENTITY_ROUTES.partners.new}>+ New partner</Link>
      </div>
      <div className="admin-toolbar">
        <label className="admin-visually-hidden" htmlFor="partner-tier">Filter by tier</label>
        <select id="partner-tier" value={tier} onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value === 'all') next.delete('tier'); else next.set('tier', e.target.value);
          setParams(next, { replace: true });
        }}>
          <option value="all">All tiers</option>
          <option value="platinum">Platinum</option>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
          <option value="community">Community</option>
        </select>
      </div>
      {loading ? <LoadingSkeleton label="Loading partners…" /> : null}
      {!loading && error ? <ErrorState error={error} requestId={requestId} onRetry={retry} context="load partners" /> : null}
      {!loading && !error && missing ? (
        <EmptyState
          title="No partners yet (backend module may still be pending)"
          hint="Partners is greenfield per spec §4.5 and follows the team-members pattern. The form below posts to POST /partners; if the backend 404s, the V1 backend pass has not shipped yet."
          actionLabel="+ New partner"
          actionTo={ADMIN_ENTITY_ROUTES.partners.new}
        />
      ) : null}
      {!loading && !error && !missing && rows.length === 0 ? (
        <EmptyState title="No partners match this filter" actionLabel="+ New partner" actionTo={ADMIN_ENTITY_ROUTES.partners.new} />
      ) : null}
      {!loading && !error && rows.length > 0 ? (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th scope="col">Name</th><th scope="col">Tier</th><th scope="col">Order</th><th scope="col">Status</th></tr></thead>
            <tbody>
              {rows.map((p) => {
                const id = getId(p) ?? p.slug;
                return (
                  <tr key={id}>
                    <td><Link to={ADMIN_ENTITY_ROUTES.partners.detail(id)}>{p.name}</Link></td>
                    <td><span className="admin-pill">{p.tier ?? '—'}</span></td>
                    <td>{p.display_order ?? 0}</td>
                    <td><StatusPill status={p.status} active={p.is_active} /></td>
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
