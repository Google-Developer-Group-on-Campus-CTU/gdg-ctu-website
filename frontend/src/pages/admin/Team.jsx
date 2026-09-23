import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getId, teamApi } from '../../api/resources.js';
import { ADMIN_ENTITY_ROUTES, useAdminList, useDebouncedValue } from '../../admin/editorial.js';
import { AdminListPage, EmptyState, StatusPill } from '../../components/admin/shared.jsx';

export default function AdminTeam() {
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const debounced = useDebouncedValue(q);
  const { data, loading, error, requestId, retry } = useAdminList(() => teamApi.list(), 'team');

  const rows = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    if (!term) return data ?? [];
    return (data ?? []).filter((m) =>
      [m.firstName ?? m.first_name, m.lastName ?? m.last_name, m.roleTitle ?? m.role_title, m.department, m.program]
        .filter(Boolean).join(' ').toLowerCase().includes(term),
    );
  }, [data, debounced]);

  return (
    <section aria-label="Team members">
      <div className="admin-page-head">
        <div>
          <h1>Team</h1>
          <p className="admin-muted">Photo · name · roleTitle · dept/program/year · order · active.</p>
        </div>
        <Link className="gdg-btn gdg-btn-primary" to={ADMIN_ENTITY_ROUTES.team.new}>+ New member</Link>
      </div>
      <AdminListPage
        loading={loading}
        loadingLabel="Loading team…"
        error={error}
        requestId={requestId}
        onRetry={retry}
        errorContext="load team"
        isEmpty={rows.length === 0}
        empty={
          <EmptyState title="No team members yet" hint="Create the first profile as a draft." actionLabel="+ New member" actionTo={ADMIN_ENTITY_ROUTES.team.new} />
        }
      >
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Dept / Program / Year</th><th scope="col">Order</th><th scope="col">Status</th></tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const id = getId(m) ?? m.slug;
                const name = `${m.firstName ?? m.first_name ?? ''} ${m.lastName ?? m.last_name ?? ''}`.trim() || '(unnamed)';
                return (
                  <tr key={id}>
                    <td><Link to={ADMIN_ENTITY_ROUTES.team.detail(id)}>{name}</Link>{m.is_featured ? ' ★' : ''}</td>
                    <td>{m.roleTitle ?? m.role_title ?? '—'}</td>
                    <td>{[m.department, m.program, m.yearSection ?? m.year_section].filter(Boolean).join(' · ') || '—'}</td>
                    <td>{m.display_order ?? 0}</td>
                    <td><StatusPill status={m.status} active={m.is_active} /></td>
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
