# Admin DataTable (shared)

> **Authoritative spec:** `docs/admin-material3-design.md` §5. This file is an
> implementation companion, not the design authority. Where values disagree,
> the M3 spec wins.
>
> **API freeze (pre Team/Partners rollout):** the `DataTable` props API below
> is frozen. Do not add/rename/remove props without orchestrator approval.
> The TanStack import stays pinned to the legacy compat layer
> (`useLegacyTable` from `@tanstack/react-table/legacy` + `flexRender` from
> the root) — do NOT migrate to `useTable` + `features` yet. Team/Partners
> pages must reuse this component as-is; pilot fixes land here first.

Shared admin table infra: shadcn `Table` primitives + TanStack Table v9
(`@tanstack/react-table` 9.x). Lives at
`frontend/src/components/admin/data-table.jsx`. Rolled out to all list pages
(Events pilot + Team/Partners/Gallery/Media/Content/Invites/Users — see
Status below).

## Styling (M3 per `docs/admin-material3-design.md` §5)

M3 table theme (semantic role tokens only, never raw hex outside token
definitions): `surface` container with 1px `outline-variant` border,
`extra-small` 4px radius, elevation 0; header row 56px tall with
`surface-container` fill and `title-small` (14/500) `on-surface-variant`
label, **no uppercase**; body rows 52px tall, `body-medium` (14/400)
`on-surface` text, 16px horizontal cell padding, 1px `outline-variant`
dividers, no zebra; hover = `on-surface` state layer 0.08; selected =
`surface-container-highest`; footer/pagination bar 52px, `label-medium`
`on-surface-variant`; sort icon 18px (`on-surface-variant`, active `primary`);
checkbox 18px (`primary` when checked). The stock shadcn `Table` has no
border/shadow, so the card treatment lives on the `DataTable` wrapper —
never restyle the Table primitives themselves:

- wrapper: `surface` container, 1px `outline-variant` border, 4px
  (`extra-small`) radius, elevation 0, with a **single** `overflow-x-auto`
  div around `<Table>` (exactly one horizontal scroll region with
  `overscroll-behavior: contain`) so <640px viewports scroll horizontally
  without losing the clip; header row is `surface-container` fill
- toolbar controls: search `Input` + scope `SelectTrigger` are M3 dense
  `h-10` (40px visual, 48px hit area per §4.2 dense rule), `extra-small` 4px
  shape
- sortable header buttons: sort control is a `button` **inside** the `th`
  (never the `th` itself) with `aria-label="Sort by <column>"`; 48x48 hit
  area (dense 40px visual allowed)
- empty/error states: centered empty state (icon + `title-medium` heading +
  `body-medium` description + single Filled/Tonal CTA, skeleton rows preserve
  52px height, no layout shift); error is an inline `error-container` alert
  above the table with a Retry action

## Props API

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `columns` | `ColumnDef[]` | — | TanStack defs; use `DataTableColumnHeader` for sortable headers |
| `data` | `object[]` | `[]` | Row data |
| `loading` / `error` / `onRetry` | `bool` / `err` / `fn` | `false` / `null` | Skeleton rows / error card + Retry button |
| `requestId` | `string` | — | Rendered **inside** the error card (`Request ID: …`); pass `useAdminList`'s `requestId` instead of a separate line under the table |
| `renderError` | `node` / `fn({ error, onRetry, requestId })` | default brand error card | Full error override; function form receives the error context |
| `searchColumnId` / `searchPlaceholder` | `string` | `'title'` / `'Search…'` | Search `Input` filters this column when uncontrolled |
| `searchValue` / `onSearchChange` | `string` / `fn` | uncontrolled | Controlled search (required for server-backed lists) |
| `scopes` | `{value,label}[]` | `[]` | Renders the scope `Select` only when non-empty; include `{ value: 'all', label: '…' }` |
| `scopeColumnId` / `scopeValue` / `onScopeChange` | `string` / `string` / `fn` | `'scope'` / uncontrolled | `'all'` clears the column filter |
| `sorting` / `onSortingChange`, `columnFilters` / `onColumnFiltersChange`, `pagination` / `onPaginationChange` | state + setter | internal `useState` | Pass all three controlled for manual (server) modes |
| `manualSorting` / `manualFiltering` / `manualPagination` | `bool` | `false` | Server-backed Express API mode |
| `rowCount` / `pageCount` | `number` | — | Server total / pages; `pageCount` defaults to `ceil(rowCount / pageSize)` |
| `pageSizeOptions` | `number[]` | `[10, 20]` | Page-size `Select` options |
| `renderEmptyState` | `node` | brand card | Override; default is the brand card (`G` tile, `emptyTitle` / `emptyHint`) |
| `loadingLabel` | `string` | `'Loading…'` | Toolbar live region + sr-only status |
| `className` | `string` | — | Outer div passthrough |

Toolbar count and the `Showing X–Y of Z` footer line are both
`aria-live="polite"`. Every header `<th>` carries `scope="col"`; only
sortable columns emit `aria-sort` (`ascending` / `descending` / `none`) —
non-sortable headers carry no `aria-sort` (DataTable-side on `TableHead` —
no `table.tsx` override needed).

When controlled search/filter props (`searchValue`, `scopeValue`,
`columnFilters`) change, `DataTable` resets `pageIndex` to `0` (internal
state, or via `onPaginationChange` when pagination is controlled) so heavy
filtering never strands the user on a stale page. Uncontrolled typing
already resets through the toolbar handlers.

Previous/Next are Outlined buttons at M3 dense 40px visual height with a
48x48 hit area (§4.2 dense rule); the M3 flat card wrapper (`surface`, 1px
`outline-variant`, 4px radius, elevation 0) is unchanged.

## Usage — Events pilot (client-side first)

```jsx
import { Link } from 'react-router-dom';
import { DataTable, DataTableColumnHeader } from '../../components/admin/data-table.jsx';
import { StatusPill } from '../../components/admin/shared.jsx';
import { ADMIN_ENTITY_ROUTES, timeAgo } from '../../admin/editorial.js';
import { getId } from '../../api/resources.js';

const columns = [
  {
    accessorKey: 'title',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
    cell: ({ row }) => {
      const event = row.original;
      const id = getId(event) ?? event.slug;
      return <Link to={ADMIN_ENTITY_ROUTES.events.detail(id)}>{event.title ?? '(untitled)'}</Link>;
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => <StatusPill status={row.original.status} active={row.original.is_active} />,
  },
  {
    accessorKey: 'startAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Start" />,
    cell: ({ row }) => timeAgo(row.original.startAt ?? row.original.start_at),
  },
];

const SCOPES = [
  { value: 'all', label: 'All scopes' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'featured', label: 'Featured' },
];

export function EventsTable({ rows, loading, error, onRetry }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      loading={loading}
      error={error}
      onRetry={onRetry}
      searchColumnId="title"
      searchPlaceholder="Search events…"
      scopes={SCOPES}
      scopeColumnId="scope"
      emptyTitle="No events match this filter"
      emptyHint="Create a draft event to get started."
    />
  );
}
```

Note: the pilot page derives a `scope` field per row (`scopeOf` in
`pages/admin/Events.jsx`) so the client-side scope filter has a column to
match, and keeps its debounced `?q=` / `?scope=` URL params until migration.

## Server-backed sketch (query-key driven, later)

```jsx
const [sorting, setSorting] = useState([]);
const [columnFilters, setColumnFilters] = useState([]);
const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });
// queryKey: ['events', { pagination, sorting, q, scope }] → GET /events?page=&limit=&sort=&q=&scope=
const { data, loading, error, retry } = useAdminList(fetcher, queryKey);

<DataTable
  columns={columns}
  data={data?.items ?? []}
  loading={loading}
  error={error}
  onRetry={retry}
  manualSorting
  manualFiltering
  manualPagination
  rowCount={data?.total ?? 0}
  sorting={sorting}
  onSortingChange={setSorting}
  columnFilters={columnFilters}
  onColumnFiltersChange={setColumnFilters}
  pagination={pagination}
  onPaginationChange={setPagination}
  searchValue={q}
  onSearchChange={setQ}
  scopes={SCOPES}
  scopeValue={scope}
  onScopeChange={setScope}
/>;
```

## Team/Partners template (implemented — `pages/admin/Team.jsx`, `pages/admin/Partners.jsx`)

Team/Partners lists reuse `<DataTable>` as-is and re-add the three columns
the Events pilot dropped. Do NOT add these to Events — this template is the
rollout reference the Team/Partners pages follow (cover thumb via
`pickImage`, sortable `display_order`, Active toggle with optimistic
`update` + revert; real code uses `teamApi.update` / `partnersApi.update`,
which issue PATCH):

```jsx
import { useState } from 'react';
import { DataTableColumnHeader } from '../../components/admin/data-table.jsx';
import { Toggle } from '../../components/admin/shared.jsx';

const columns = [
  // 1. Cover thumb 56×40 (w-14 h-10), decorative image
  {
    accessorKey: 'coverUrl',
    header: 'Cover',
    enableSorting: false,
    cell: ({ row }) => {
      const src = row.original.coverUrl ?? row.original.cover_url;
      const label = row.original.name ?? row.original.title ?? '(untitled)';
      return src ? (
        <img
          src={src}
          alt=""
          aria-label={`Cover for ${label}`}
          className="h-10 w-14 rounded-md border border-border object-cover"
        />
      ) : (
        <span className="flex h-10 w-14 items-center justify-center rounded-md border border-border bg-muted text-xs text-muted-foreground">
          —
        </span>
      );
    },
  },
  // 2. display_order (sortable) — authoring order, still editable on detail
  {
    accessorKey: 'display_order',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Order" />,
    cell: ({ row }) => row.original.display_order ?? '—',
  },
  // 3. Active toggle — shared.jsx <Toggle>, optimistic PATCH with revert
  {
    id: 'active',
    accessorFn: (item) => item.is_active,
    header: 'Active',
    enableSorting: false,
    cell: ({ row }) => <ActiveCell row={row} />,
  },
];

function ActiveCell({ row }) {
  const item = row.original;
  const id = item.id ?? item.slug;
  const [active, setActive] = useState(!!item.is_active);
  return (
    <Toggle
      id={`active-${id}`}
      label="Active"
      checked={active}
      onChange={(next) => {
        setActive(next); // optimistic
        membersApi
          .patch(id, { is_active: next })
          .catch(() => setActive(!next)); // revert on failure
      }}
    />
  );
}
```

Notes: keep the thumb decorative (`alt=""`) with the row label on
`aria-label`; `display_order` stays a plain sortable column (reorder UX
lives on the detail page); the toggle is per-row local state + PATCH, not
table state — never wire it into `columnFilters`/`sorting`.

## Status

- [x] Shared `DataTable` + `DataTableColumnHeader` built on shadcn Table + TanStack v9
- [x] Pilot migration: `pages/admin/Events.jsx` — raw `.admin-table` replaced with
  `<DataTable>` (title link · `StatusPill` status · updated · scope via `scopeOf` ·
  single Manage row action opening the detail editor). Preserved: `useAdminList(eventsApi.list)`, `?q`/`?scope`
  URL sync with `useDebouncedValue` (250ms default), live result count, Skeleton
  loading, `EmptyState` brand card + New pill via `adminNewTargetFor`, error +
  Retry + requestId line, 44px action targets, `aria-sort` headers. Page size 20
  default (`pageSizeOptions={[20, 10]}`). Dropped from the old table per pilot
  spec: cover thumb, `display_order`, and the inline Active toggle (all still
  editable on the detail page). Do not migrate other pages until this pilot
  passes orchestrator + designer review.
- [x] Team rollout: `pages/admin/Team.jsx` — `<DataTable>` (cover thumb via
  `pickImage` + `admin-thumb` 56×40 · sortable Name link · Role · Dept ·
  sortable `display_order` · `StatusPill` + Active `Toggle` with optimistic
  `teamApi.update` + revert · single Manage action). `?q` + `?scope=<dept>`
  URL sync (debounced 250ms, department options derived from data), `requestId`
  inside the error card, page size 20 default. No extra borders.
- [x] Partners rollout: `pages/admin/Partners.jsx` — `<DataTable>` (logo thumb
  · sortable Name link · Tier pill · sortable `display_order` · `StatusPill` +
  Active `Toggle` with optimistic `partnersApi.update` + revert · single Manage
  action). `?q` + `?tier=` URL sync (debounced 250ms), tier→order client sort
  kept, 404→`[]` loader kept, `requestId` inside the error card, page size 20
  default. No extra borders.
- [x] Gallery rollout: `pages/admin/Gallery.jsx` — `<DataTable>` (cover thumb ·
  sortable Title link · event link · sortable photo counts enriched from the
  `album-items` list · Featured · `StatusPill` · single Manage action). Keeps
  both loaders (albums 404→`[]` kept; items errors surface instead of zero
  counts), combined retry, `?q` URL sync (debounced 250ms), `requestId` inside
  the error card, page size 20 default. No scope filter (albums have no scope
  facet). No extra borders.
- [x] Media rollout: `pages/admin/Media.jsx` — card grid replaced with
  `<DataTable>` (preview thumb with real alt text · sortable File + dims/size
  sub-line · Alt text · sortable `used in N` with tabular numerals so async
  counts fill without layout shift · mono ID · Copy ID + Delete actions at
  44px). Keeps `MEDIA_ALLOW`/4MB/alt-required upload form, toasts,
  usage-count computation, and `TypedConfirm` delete (never-used drafts only).
  Copy ID added (clipboard + toast fallback; no Copy ID existed before).
  `?q` URL sync over filename/alt/ID (debounced 250ms), `requestId` inside the
  error card, page size 20 default. No detail route exists for media, so no
  Manage pill. No extra borders.
- [x] Content rollout: `pages/admin/Content.jsx` — `<DataTable>` over the six
  fixed `CONTENT_KEYS` rows (sortable Section link · Title with "not created"
  fallback · `StatusPill` / "missing" · single Manage action opening the
  detail editor, which creates the row on first save). 404→`[]` loader kept,
  `?q` URL sync added (section key + title, debounced 250ms), `requestId`
  inside the error card, page size 20 default. No extra borders.
- [x] Invites rollout: `pages/admin/Invites.jsx` — `<DataTable>` (Status ·
  sortable Code `id` · sortable Created · sortable Expires · Role · Used by ·
  Created by · Revoke action at 44px for unused invites). Keeps the create
  flow (once-only link notice + copy fallback), `RevokeConfirm` dialog with
  busy/error states, newest-first client sort, `?q` URL sync (debounced
  250ms), `requestId` inside the error card, page size 20 default. No detail
  route exists for invites, so Revoke is the only row action. Role column
  renders `invite.role ?? 'admin'`: GET `/admin-invites` returns no per-invite
  role and every invite redeems to an admin account. No extra borders.
- [x] Users rollout: `pages/admin/Users.jsx` — `<DataTable>` (sortable Name
  with `(you)` self-marker · sortable Email · Role pill · banned/verified
  status pill · sortable Joined · list-level Make admin/Make user/Unban/Ban/
  Delete actions at 44px behind the existing `UserActionConfirm` dialog +
  self-row guard). Keeps Better Auth plugin flows verbatim (`unwrap`/`asError`
  normalization, ban-window `isBanned`, unban inline + `pageActionError`,
  `LIST_LIMIT` 50 cap notice), `?q` URL sync (debounced 250ms), `requestId`
  inside the error card, page size 20 default. Confirms stay list-level by
  choice: no user detail route exists, so no Manage pill. No extra borders.

## M3 conformance (Phase 7)

Visual authority is `docs/admin-material3-design.md` §5: 4px container, 56px
header / 52px rows / 52px pagination footer, `title-small` header with no
uppercase, 48px sort targets (dense 40px visual allowed), single scroll
wrapper, semantic role tokens with native `table` semantics (`caption`,
`scope="col"`, `aria-sort`, sort `button` in `th`). `useLegacyTable` /
`flexRender` remain frozen (styling-only change).
