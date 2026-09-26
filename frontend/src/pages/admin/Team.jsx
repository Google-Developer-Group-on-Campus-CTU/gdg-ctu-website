import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { getId, memberTermsApi, teamApi } from '../../api/resources.js';
import { mapTerm, pickImage, publicApi } from '../../api/public.js';
import {
  ADMIN_ENTITY_ROUTES,
  adminNewTargetFor,
  useAdminList,
  useDebouncedValue,
} from '../../admin/editorial.js';
import { DataTable, DataTableColumnHeader } from '../../components/admin/data-table.jsx';
import { EmptyState, StatusPill } from '../../components/admin/shared.jsx';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';

function memberName(m) {
  return `${m.firstName ?? m.first_name ?? ''} ${m.lastName ?? m.last_name ?? ''}`.trim() || '(unnamed)';
}

function deptOf(m) {
  return [m.department, m.program, m.yearSection ?? m.year_section].filter(Boolean).join(' · ') || '—';
}

function roleOf(m, termRows, termId) {
  if (termId) {
    const row = termRows.find(
      (r) => String(r.memberId ?? r.member_id ?? '') === String(getId(m) ?? m.slug)
        && String(r.termId ?? r.term_id ?? '') === String(termId),
    );
    if (row?.role) return row.role;
  }
  return m.role ?? m.roleTitle ?? m.role_title ?? '—';
}

function orderOf(m, termRows, termId) {
  if (termId) {
    const row = termRows.find(
      (r) => String(r.memberId ?? r.member_id ?? '') === String(getId(m) ?? m.slug)
        && String(r.termId ?? r.term_id ?? '') === String(termId),
    );
    if (row) return row.displayOrder ?? row.display_order ?? 0;
  }
  return m.displayOrder ?? m.display_order ?? 0;
}

function MemberStatusCell({ row }) {
  const member = row.original;
  // UUID only for data calls — PATCH /team-members/:id requires a UUID.
  // `key` (id ?? slug) is for React keys / element ids only.
  const id = member?.id ?? member?._id ?? member?.uuid;
  const slug = member?.slug;
  const key = id ?? slug;
  const [active, setActive] = useState(!!(member.isActive ?? member.is_active));
  if (!key) {
    return (
      <div className="flex min-h-[32px] flex-wrap items-center gap-x-3 gap-y-1">
        <StatusPill status={member.status} active={member.isActive ?? member.is_active} />
      </div>
    );
  }
  return (
    <div className="flex min-h-[32px] flex-wrap items-center gap-x-3 gap-y-1">
      <StatusPill status={member.status} active={member.isActive ?? member.is_active} />
      <Switch
        size="small"
        inputProps={{ 'aria-label': 'Active' }}
        checked={active}
        onChange={(e) => {
          const next = e.target.checked;
          if (!id || id === 'undefined') {
            console.warn('[admin] team toggle skipped: missing id', slug);
            return;
          }
          setActive(next); // optimistic
          teamApi.update(id, { isActive: next }).catch(() => setActive(!next));
        }}
      />
    </div>
  );
}

export default function AdminTeam() {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const q = params.get('q') ?? '';
  const scope = params.get('scope') ?? 'all';
  const termId = params.get('term') ?? '';
  const { data, loading, error, requestId, retry } = useAdminList(() => teamApi.list(), 'team');
  const debounced = useDebouncedValue(q);
  const [terms, setTerms] = useState([]);
  const [termRows, setTermRows] = useState([]);
  const [order, setOrder] = useState(null);
  const [reorderError, setReorderError] = useState(null);

  useEffect(() => {
    let alive = true;
    publicApi.getTerms().then((rows) => {
      if (!alive) return;
      setTerms((Array.isArray(rows) ? rows : []).map(mapTerm));
    }).catch(() => {});
    memberTermsApi.list({ limit: 100 })
      .catch(() => memberTermsApi.list().catch(() => []))
      .then((rows) => {
        if (!alive) return;
        setTermRows(Array.isArray(rows) ? rows : []);
      }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const members = useMemo(() => order ?? data ?? [], [order, data]);

  const scopes = useMemo(() => {
    const depts = [...new Set((members ?? []).map((m) => m.department).filter(Boolean))].sort();
    return [
      { value: 'all', label: 'All departments' },
      ...depts.map((dept) => ({ value: dept, label: dept })),
    ];
  }, [members]);

  const rows = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    const filtered = (members ?? []).filter((m) => {
      if (scope !== 'all' && (m.department ?? '') !== scope) return false;
      if (termId) {
        const hasRow = termRows.some(
          (r) => String(r.memberId ?? r.member_id ?? '') === String(getId(m) ?? m.slug)
            && String(r.termId ?? r.term_id ?? '') === String(termId),
        );
        if (!hasRow) return false;
      }
      if (!term) return true;
      return [m.firstName ?? m.first_name, m.lastName ?? m.last_name, m.roleTitle ?? m.role_title ?? m.role, m.department, m.program]
        .filter(Boolean).join(' ').toLowerCase().includes(term);
    });
    // Numeric displayOrder stays the source of truth — the list is always
    // sorted by it (term-row order when a term filter is active).
    return [...filtered].sort((a, b) => orderOf(a, termRows, termId) - orderOf(b, termRows, termId));
  }, [members, debounced, scope, termId, termRows]);

  const move = async (member, dir) => {
    const idx = rows.findIndex((r) => String(getId(r) ?? r.slug) === String(getId(member) ?? member.slug));
    const other = rows[idx + dir];
    if (!other) return;
    setReorderError(null);
    const aOrder = orderOf(member, termRows, termId);
    const bOrder = orderOf(other, termRows, termId);
    const apply = (list) => list.map((m) => {
      const key = String(getId(m) ?? m.slug);
      if (key === String(getId(member) ?? member.slug)) return { ...m, displayOrder: bOrder, display_order: bOrder };
      if (key === String(getId(other) ?? other.slug)) return { ...m, displayOrder: aOrder, display_order: aOrder };
      return m;
    });
    const base = order ?? data ?? [];
    setOrder(apply(base));
    try {
      const aId = member.id ?? member._id ?? member.uuid;
      const bId = other.id ?? other._id ?? other.uuid;
      if (aId) await teamApi.update(aId, { displayOrder: bOrder });
      if (bId) await teamApi.update(bId, { displayOrder: aOrder });
      if (termId) {
        // Keep the S.Y. row order in sync through the member-terms API.
        const syncRow = async (m, nextOrder) => {
          const row = termRows.find(
            (r) => String(r.memberId ?? r.member_id ?? '') === String(getId(m) ?? m.slug)
              && String(r.termId ?? r.term_id ?? '') === String(termId),
          );
          const rowId = row?.id ?? row?._id ?? row?.uuid;
          if (rowId) await memberTermsApi.update(rowId, { displayOrder: nextOrder });
        };
        await syncRow(member, bOrder);
        await syncRow(other, aOrder);
      }
    } catch (err) {
      setOrder(null);
      setReorderError(err?.body?.message ?? err?.message ?? 'Reorder failed — order reloaded.');
      retry();
    }
  };

  const columns = useMemo(() => [
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
        const id = member?.id ?? member?._id ?? member?.uuid;
        const slug = member?.slug;
        const key = id ?? slug;
        if (!key) return <span className="font-medium">{memberName(member)}{(member.isFeatured ?? member.is_featured) ? ' ★' : ''}</span>;
        return (
          <Link
            to={ADMIN_ENTITY_ROUTES.team.detail(key)}
            className="font-medium underline-offset-4 hover:underline"
          >
            {memberName(member)}{(member.isFeatured ?? member.is_featured) ? ' ★' : ''}
          </Link>
        );
      },
    },
    {
      id: 'role',
      accessorFn: (m) => roleOf(m, termRows, termId),
      header: 'Role',
      enableSorting: false,
      cell: ({ row }) => roleOf(row.original, termRows, termId),
    },
    {
      id: 'dept',
      accessorFn: (m) => m.department ?? '',
      header: 'Dept',
      enableSorting: false,
      cell: ({ row }) => deptOf(row.original),
    },
    {
      id: 'displayOrder',
      accessorFn: (m) => orderOf(m, termRows, termId),
      header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
      cell: ({ row }) => {
        const idx = rows.findIndex((r) => String(getId(r) ?? r.slug) === String(getId(row.original) ?? row.original.slug));
        return (
          <span className="inline-flex items-center gap-1">
            <span aria-label={`Display order ${orderOf(row.original, termRows, termId)}`}>{orderOf(row.original, termRows, termId)}</span>
            <IconButton type="button" size="small" aria-label={`Move ${memberName(row.original)} up`} disabled={idx <= 0} onClick={() => move(row.original, -1)}>↑</IconButton>
            <IconButton type="button" size="small" aria-label={`Move ${memberName(row.original)} down`} disabled={idx < 0 || idx >= rows.length - 1} onClick={() => move(row.original, 1)}>↓</IconButton>
          </span>
        );
      },
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
        const id = member?.id ?? member?._id ?? member?.uuid;
        const slug = member?.slug;
        const key = id ?? slug;
        // No standalone edit route: the detail page IS the editor (view+edit),
        // so a single Manage pill opens it. Hidden when neither id nor slug exists.
        if (!key) return <span className="admin-muted" aria-hidden="true">—</span>;
        const detail = ADMIN_ENTITY_ROUTES.team.detail(key);
        const label = memberName(member);
        return (
          <Button component={Link} variant="outlined" size="small" to={detail} aria-label={`Manage ${label}`}>
            Manage
          </Button>
        );
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [termRows, termId, rows]);

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

  const setTerm = (value) => {
    const next = new URLSearchParams(params);
    if (!value) next.delete('term');
    else next.set('term', value);
    setParams(next, { replace: true });
  };

  return (
    <section aria-label="Team members">
      <div className="admin-page-head">
        <div>
          <h1>Team</h1>
          {reorderError ? <p role="alert" className="admin-muted">{reorderError}</p> : null}
        </div>
        <Button component={Link} variant="contained" to={ADMIN_ENTITY_ROUTES.team.new}>+ New member</Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <TextField
          id="team-term-filter"
          select
          size="small"
          label="S.Y."
          value={termId}
          onChange={(e) => setTerm(e.target.value)}
          aria-label="Filter team by school year"
          className="mui-field"
          variant="outlined"
        >
          <MenuItem value="">All terms</MenuItem>
          {terms.map((t) => (
            <MenuItem key={t.id ?? t.name} value={t.id ?? ''}>
              {t.label}{t.isCurrent ? ' (Current)' : ''}
            </MenuItem>
          ))}
        </TextField>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        loadingLabel="Loading team…"
        error={error}
        requestId={requestId}
        onRetry={() => { setOrder(null); retry(); }}
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
