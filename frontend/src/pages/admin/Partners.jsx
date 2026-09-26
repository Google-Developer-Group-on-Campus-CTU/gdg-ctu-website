import { useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { partnersApi } from '../../api/resources.js';
import { pickImage } from '../../api/public.js';
import {
  ADMIN_ENTITY_ROUTES,
  adminNewTargetFor,
  useAdminList,
  useDebouncedValue,
} from '../../admin/editorial.js';
import { DataTable, DataTableColumnHeader } from '../../components/admin/data-table.jsx';
import { EmptyState, StatusPill } from '../../components/admin/shared.jsx';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';

const TIER_ORDER = { platinum: 0, gold: 1, silver: 2, community: 3 };

const TIERS = [
  { value: 'all', label: 'All tiers' },
  { value: 'platinum', label: 'Platinum' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'community', label: 'Community' },
];

function PartnerStatusCell({ row }) {
  const partner = row.original;
  // UUID only for data calls — PATCH /partners/:id requires a UUID, so a
  // slug fallback here would 400 "Invalid id". `key` (id ?? slug) is for
  // React keys / element ids only.
  const id = partner?.id ?? partner?._id ?? partner?.uuid;
  const slug = partner?.slug;
  const key = id ?? slug;
  const [active, setActive] = useState(!!partner.is_active);
  if (!key) {
    return (
      <div className="flex min-h-[32px] flex-wrap items-center gap-x-3 gap-y-1">
        <StatusPill status={partner.status} active={partner.is_active} />
      </div>
    );
  }
  return (
    <div className="flex min-h-[32px] flex-wrap items-center gap-x-3 gap-y-1">
      <StatusPill status={partner.status} active={partner.is_active} />
      <Switch
        size="small"
        inputProps={{ 'aria-label': 'Active' }}
        checked={active}
        onChange={(e) => {
          const next = e.target.checked;
          if (!id || id === 'undefined') {
            console.warn('[admin] partners toggle skipped: missing id', slug);
            return;
          }
          setActive(next); // optimistic
          partnersApi.update(id, { is_active: next }).catch(() => setActive(!next));
        }}
      />
    </div>
  );
}

/* Static column defs: logo thumb · name (detail link, sortable) · tier · order · status + active toggle · manage. */
const columns = [
  {
    id: 'cover',
    header: 'Logo',
    enableSorting: false,
    cell: ({ row }) => {
      const partner = row.original;
      const src = pickImage(partner);
      const label = partner.name ?? '(unnamed)';
      return src ? (
        <img src={src} alt="" aria-label={`Logo of ${label}`} className="admin-thumb" loading="lazy" />
      ) : (
        <span className="admin-thumb" aria-hidden="true" />
      );
    },
  },
  {
    id: 'name',
    accessorFn: (p) => p.name ?? '',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => {
      const partner = row.original;
      const id = partner?.id ?? partner?._id ?? partner?.uuid;
      const slug = partner?.slug;
      const key = id ?? slug;
      if (!key) return <span className="font-medium">{partner.name ?? '(unnamed)'}</span>;
      return (
        <Link
          to={ADMIN_ENTITY_ROUTES.partners.detail(key)}
          className="font-medium underline-offset-4 hover:underline"
        >
          {partner.name ?? '(unnamed)'}
        </Link>
      );
    },
  },
  {
    accessorKey: 'tier',
    header: 'Tier',
    enableSorting: false,
    cell: ({ row }) => <Chip size="small" label={row.original.tier ?? '—'} aria-label={`Tier: ${row.original.tier ?? 'none'}`} />,
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
    cell: ({ row }) => <PartnerStatusCell row={row} />,
  },
  {
    id: 'actions',
    header: 'Actions',
    enableSorting: false,
    cell: ({ row }) => {
      const partner = row.original;
      const id = partner?.id ?? partner?._id ?? partner?.uuid;
      const slug = partner?.slug;
      const key = id ?? slug;
      // No standalone edit route: the detail page IS the editor (view+edit),
      // so a single Manage pill opens it. Hidden when neither id nor slug exists.
      if (!key) return <span className="admin-muted" aria-hidden="true">—</span>;
      const detail = ADMIN_ENTITY_ROUTES.partners.detail(key);
      const label = partner.name ?? '(unnamed)';
      return (
        <Button component={Link} variant="outlined" size="small" to={detail} aria-label={`Manage ${label}`}>
          Manage
        </Button>
      );
    },
  },
];

export default function AdminPartners() {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
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

  const setQuery = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  const setTier = (value) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete('tier');
    else next.set('tier', value);
    setParams(next, { replace: true });
  };

  return (
    <section aria-label="Partners">
      <div className="admin-page-head">
        <div>
          <h1>Partners</h1>
        </div>
        <Button component={Link} variant="contained" to={ADMIN_ENTITY_ROUTES.partners.new}>+ New partner</Button>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        loadingLabel="Loading partners…"
        error={error}
        requestId={requestId}
        onRetry={retry}
        searchColumnId="name"
        searchPlaceholder="Search partners…"
        searchValue={q}
        onSearchChange={setQuery}
        scopes={TIERS}
        scopeColumnId="tier"
        scopeValue={tier}
        onScopeChange={setTier}
        scopePlaceholder="All tiers"
        scopeLabel="Filter by tier"
        pageSizeOptions={[20, 10]}
        renderEmptyState={
          <EmptyState
            title={data.length === 0 ? 'No partners yet' : 'No partners match this filter'}
            hint={data.length === 0 ? 'Backend module may still be pending — the form posts to POST /partners.' : undefined}
            actionLabel="+ New partner"
            actionTo={adminNewTargetFor(pathname)}
          />
        }
      />
    </section>
  );
}
