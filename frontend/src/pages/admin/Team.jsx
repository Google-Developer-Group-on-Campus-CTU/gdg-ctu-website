import { useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { getId, teamApi } from '../../api/resources.js';
import { pickImage } from '../../api/public.js';
import {
  ADMIN_ENTITY_ROUTES,
  adminNewTargetFor,
  useAdminList,
  useDebouncedValue,
} from '../../admin/editorial.js';
import { DataTable, DataTableColumnHeader } from '../../components/admin/data-table.jsx';
import { EmptyState, StatusPill, Toggle } from '../../components/admin/shared.jsx';

function memberName(m) {
  return `${m.firstName ?? m.first_name ?? ''} ${m.lastName ?? m.last_name ?? ''}`.trim() || '(unnamed)';
}

function deptOf(m) {
  return [m.department, m.program, m.yearSection ?? m.year_section].filter(Boolean).join(' · ') || '—';
}

/* 32px row-action targets — quiet bordered buttons, no extra card borders (DataTable owns the wrapper). */
const ACTION_LINK_CLASS =
  'inline-flex h-8 items-center px-3 rounded-[3px] border border-[#DFE1E6] bg-[#FAFBFC] text-sm font-medium text-[#42526E] hover:bg-[#EBECF0] hover:text-[#172B4D]';

function MemberStatusCell({ row }) {
  const member = row.original;
  const id = getId(member) ?? member.slug;
  const [active, setActive] = useState(!!member.is_active);
  return (
    <div className="flex min-h-[32px] flex-wrap items-center gap-x-3 gap-y-1">
      <StatusPill status={member.status} active={member.is_active} />
      <Toggle
        id={`team-active-${id}`}
        label="Active"
        checked={active}
        onChange={(next) => {
          setActive(next); // optimistic
          teamApi.update(id, { is_active: next }).catch(() => setActive(!next));
        }}
      />
    </div>
  );
}

/* Static column defs: cover thumb · name (detail link, sortable) · role · dept · order · status + active toggle · manage. */
const columns = [
  {
    id: 'cover',
    header: 'Cover',
    enableSorting: false,
    cell: ({ row }) => {
      const member = row.original;
      const src = pickImage(member);
      const label = memberName(member);
      return src ? (
        <img src={src} alt="" aria-label={`Photo of ${label}`} className="admin-thumb" loading="lazy" />
      ) : (
        <span className="admin-thumb" aria-hidden="true" />
      );
    },
  },
  {
    id: 'name',
    accessorFn: (m) => memberName(m),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => {
      const member = row.original;
      const id = getId(member) ?? member.slug;
      return (
        <Link
          to={ADMIN_ENTITY_ROUTES.team.detail(id)}
          className="font-medium underline-offset-4 hover:underline"
        >
          {memberName(member)}{member.is_featured ? ' ★' : ''}
        </Link>
      );
    },
  },
  {
    id: 'role',
    accessorFn: (m) => m.roleTitle ?? m.role_title ?? '',
    header: 'Role',
    enableSorting: false,
    cell: ({ row }) => row.original.roleTitle ?? row.original.role_title ?? '—',
  },
  {
    id: 'dept',
    accessorFn: (m) => m.department ?? '',
    header: 'Dept',
    enableSorting: false,
    cell: ({ row }) => deptOf(row.original),
  },
  {
    accessorKey: 'display_order',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
    cell: ({ row }) => row.original.display_order ?? 0,
  },
  {
    id: 'status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => <MemberStatusCell row={row} />,
  },
  {
    id: 'actions',
    header: 'Actions',
    enableSorting: false,
    cell: ({ row }) => {
      const member = row.original;
      const id = getId(member) ?? member.slug;
      // No standalone edit route: the detail page IS the editor (view+edit),
      // so a single Manage pill opens it.
      const detail = ADMIN_ENTITY_ROUTES.team.detail(id);
      const label = memberName(member);
      return (
        <Link to={detail} className={ACTION_LINK_CLASS} aria-label={`Manage ${label}`}>
          Manage
        </Link>
      );
    },
  },
];

export default function AdminTeam() {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const q = params.get('q') ?? '';
  const scope = params.get('scope') ?? 'all';
  const { data, loading, error, requestId, retry } = useAdminList(() => teamApi.list(), 'team');
  const debounced = useDebouncedValue(q);

  const scopes = useMemo(() => {
    const depts = [...new Set((data ?? []).map((m) => m.department).filter(Boolean))].sort();
    return [
      { value: 'all', label: 'All departments' },
      ...depts.map((dept) => ({ value: dept, label: dept })),
    ];
  }, [data]);

  const rows = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    return (data ?? []).filter((m) => {
      if (scope !== 'all' && (m.department ?? '') !== scope) return false;
      if (!term) return true;
      return [m.firstName ?? m.first_name, m.lastName ?? m.last_name, m.roleTitle ?? m.role_title, m.department, m.program]
        .filter(Boolean).join(' ').toLowerCase().includes(term);
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
    <section aria-label="Team members">
      <div className="admin-page-head">
        <div>
          <h1>Team</h1>
          <p className="admin-muted">Searchable table · ?scope=&lt;department&gt; respected.</p>
        </div>
        <Link className="admin-new-btn" to={ADMIN_ENTITY_ROUTES.team.new}>+ New member</Link>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        loadingLabel="Loading team…"
        error={error}
        requestId={requestId}
        onRetry={retry}
        searchColumnId="name"
        searchPlaceholder="Search team…"
        searchValue={q}
        onSearchChange={setQuery}
        scopes={scopes}
        scopeColumnId="dept"
        scopeValue={scope}
        onScopeChange={setScope}
        scopePlaceholder="All departments"
        scopeLabel="Filter by department"
        pageSizeOptions={[20, 10]}
        renderEmptyState={
          <EmptyState
            title={data.length === 0 ? 'No team members yet' : 'No team members match this filter'}
            hint="Create the first profile as a draft."
            actionLabel="+ New member"
            actionTo={adminNewTargetFor(pathname)}
          />
        }
      />
    </section>
  );
}
