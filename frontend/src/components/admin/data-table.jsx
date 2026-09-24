import { useEffect, useState } from 'react';
import { flexRender } from '@tanstack/react-table';
// v9 moved the v8-style API to a compat layer: `useLegacyTable` accepts the
// same options object (state/onXChange/manual*/pageCount) and the get*RowModel
// stubs act as feature markers. Keep this import pinned to /legacy until a
// deliberate migration to the `useTable` + `features` API.
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useLegacyTable as useReactTable,
} from '@tanstack/react-table/legacy';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

/**
 * Shared admin DataTable — shadcn Table primitives + TanStack Table.
 *
 * Quiet Jira-style card treatment (1px border + subtle shadow + rounded-md
 * clip). Do NOT restyle Table/TableHeader/TableBody themselves.
 * The table scrolls inside an explicit `overflow-x-auto` child div so <640px
 * viewports scroll horizontally while the card keeps its rounded-md clip +
 * quiet shadow.
 */
const WRAPPER_CLASS =
  'overflow-hidden rounded-md border border-border bg-card shadow-[0_1px_1px_rgba(9,30,66,0.13),0_0_1px_rgba(9,30,66,0.13)]';

const ALL = 'all';

function friendlyTableError(error) {
  if (!error) return 'Could not load this content.';
  if (error.status === 401) return 'You are signed out. Sign in again to continue.';
  if (error.status === 403) return 'Account deactivated — contact tech/web officer.';
  if (error.status === 404) return 'This backend module is not deployed yet.';
  return error?.body?.message ?? error?.message ?? 'Could not load this content.';
}

/**
 * Compact sortable header button. Use as a column `header`:
 *   header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />
 */
export function DataTableColumnHeader({ column, title }) {
  if (!column.getCanSort()) return <span>{title}</span>;
  const sorted = column.getIsSorted();
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className="-ml-2 h-6 rounded-[3px]"
      aria-label={`Sort by ${title}${sorted === 'asc' ? ' (sorted ascending)' : sorted === 'desc' ? ' (sorted descending)' : ''}`}
    >
      {title}
      <Icon className="size-3.5" aria-hidden="true" />
    </Button>
  );
}

function DefaultEmptyState({ title, hint }) {
  return (
    <Card className={WRAPPER_CLASS}>
      <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
        <span
          className="flex size-8 items-center justify-center rounded-[3px] bg-[#DEEBFF] text-sm font-bold text-[#0747A6]"
          aria-hidden="true"
        >
          G
        </span>
        <p className="font-heading text-base font-medium">{title}</p>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function DefaultErrorState({ error, onRetry, requestId }) {
  return (
    <Card className={WRAPPER_CLASS}>
      <CardContent className="flex flex-col items-start gap-3 py-8">
        <div role="alert" className="flex flex-col gap-1">
          <p className="font-heading text-base font-medium">Something went wrong</p>
          <p className="text-sm text-muted-foreground">{friendlyTableError(error)}</p>
          {requestId ? (
            <p className="text-xs text-muted-foreground">Request ID: {requestId}</p>
          ) : null}
        </div>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-[3px]" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * <DataTable columns data ... />
 *
 * Client-side by default (sorting/filtering/pagination in-memory).
 * For server-backed Express lists, pass manualSorting/manualFiltering/
 * manualPagination + rowCount and drive fetching from the state you hold
 * (query-key driven — see docs/admin-data-table.md).
 */
export function DataTable({
  columns,
  data = [],
  loading = false,
  error = null,
  onRetry,
  // toolbar — search
  searchColumnId = 'title',
  searchPlaceholder = 'Search…',
  searchValue,
  onSearchChange,
  // toolbar — scope
  scopes = [],
  scopeColumnId = 'scope',
  scopeValue,
  onScopeChange,
  scopePlaceholder = 'All scopes',
  scopeLabel = 'Filter by scope',
  // table state (controlled in manual modes)
  sorting: controlledSorting,
  onSortingChange,
  columnFilters: controlledColumnFilters,
  onColumnFiltersChange,
  pagination: controlledPagination,
  onPaginationChange,
  manualSorting = false,
  manualFiltering = false,
  manualPagination = false,
  rowCount,
  pageCount,
  pageSizeOptions = [10, 20],
  // states render
  loadingLabel = 'Loading…',
  renderEmptyState,
  renderError,
  requestId,
  emptyTitle = 'No results',
  emptyHint,
  className,
}) {
  const [internalSorting, setInternalSorting] = useState([]);
  const [internalColumnFilters, setInternalColumnFilters] = useState([]);
  const [internalPagination, setInternalPagination] = useState({
    pageIndex: 0,
    pageSize: pageSizeOptions[0] ?? 10,
  });

  // Reset to the first page when controlled search/filter props change so a
  // heavily filtered list never strands the user on a stale (empty) page.
  // Uncontrolled typing already resets via handleSearch/handleScope below;
  // this covers the controlled path (e.g. Events pilot drives search/scope
  // from URL params while pagination stays internal).
  const paginationIsControlled = controlledPagination !== undefined;
  useEffect(() => {
    if (paginationIsControlled) {
      if (
        controlledPagination.pageIndex !== 0 &&
        typeof onPaginationChange === 'function'
      ) {
        onPaginationChange({ ...controlledPagination, pageIndex: 0 });
      }
    } else {
      setInternalPagination((prev) =>
        prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 },
      );
    }
    // Intentionally keyed on controlled filter inputs only — not on the
    // pagination state/setters themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue, scopeValue, controlledColumnFilters]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    manualSorting,
    manualFiltering,
    manualPagination,
    pageCount:
      pageCount ??
      (rowCount != null ? Math.ceil(rowCount / (controlledPagination ?? internalPagination).pageSize) : undefined),
    state: {
      sorting: controlledSorting ?? internalSorting,
      columnFilters: controlledColumnFilters ?? internalColumnFilters,
      pagination: controlledPagination ?? internalPagination,
    },
    onSortingChange: onSortingChange ?? setInternalSorting,
    onColumnFiltersChange: onColumnFiltersChange ?? setInternalColumnFilters,
    onPaginationChange: onPaginationChange ?? setInternalPagination,
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const visibleRows = table.getRowModel().rows;
  const total = manualPagination
    ? (rowCount ?? data.length)
    : table.getFilteredRowModel().rows.length;
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = manualPagination
    ? pageIndex * pageSize + visibleRows.length
    : Math.min((pageIndex + 1) * pageSize, total);

  const searchColumn = table.getColumn(searchColumnId);
  const activeSearch = searchValue ?? searchColumn?.getFilterValue() ?? '';
  const handleSearch = (value) => {
    if (onSearchChange) {
      onSearchChange(value);
    } else {
      table.resetPageIndex();
      searchColumn?.setFilterValue(value);
    }
  };

  const showScope = scopes.length > 0;
  const scopeColumn = table.getColumn(scopeColumnId);
  const activeScope = scopeValue ?? scopeColumn?.getFilterValue() ?? ALL;
  const handleScope = (value) => {
    if (onScopeChange) {
      onScopeChange(value);
    } else {
      table.resetPageIndex();
      scopeColumn?.setFilterValue(value === ALL ? undefined : value);
    }
  };

  const columnCount = table.getAllColumns().length || columns.length || 1;
  const skeletonRows = table.getState().pagination.pageSize;

  if (!loading && error) {
    if (renderError) {
      return typeof renderError === 'function'
        ? renderError({ error, onRetry, requestId })
        : renderError;
    }
    return <DefaultErrorState error={error} onRetry={onRetry} requestId={requestId} />;
  }

  return (
    <div className={className}>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="search">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <label className="sr-only" htmlFor={`datatable-search-${searchColumnId}`}>
            {searchPlaceholder}
          </label>
          <Input
            id={`datatable-search-${searchColumnId}`}
            type="search"
            className="h-8 rounded-[3px] bg-[#FAFBFC] pr-3 pl-9"
            placeholder={searchPlaceholder}
            value={activeSearch}
            onChange={(e) => handleSearch(e.target.value)}
            disabled={loading}
          />
        </div>
        {showScope ? (
          <>
            <label className="sr-only" htmlFor="datatable-scope">
              {scopeLabel}
            </label>
            <Select value={activeScope} onValueChange={handleScope} disabled={loading}>
              <SelectTrigger
                id="datatable-scope"
                className="h-8 rounded-[3px]"
              >
                <SelectValue placeholder={scopePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {scopes.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {loading ? loadingLabel : `${total} result(s)`}
        </span>
      </div>

      {!loading && visibleRows.length === 0 ? (
        renderEmptyState ?? <DefaultEmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <div className={WRAPPER_CLASS}>
          <div className="overflow-x-auto">
            <Table>
            <TableHeader className="border-b border-[#EBECF0] bg-[#FAFBFC]">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sortable = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        scope="col"
                        className="h-8 px-3 text-[11px] font-semibold uppercase text-muted-foreground"
                        aria-sort={
                          sortable
                            ? sorted
                              ? sorted === 'asc'
                                ? 'ascending'
                                : 'descending'
                              : 'none'
                            : undefined
                        }
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                    <TableRow key={`skeleton-${rowIndex}`} className="hover:bg-[#F4F5F7]">
                      {Array.from({ length: columnCount }).map((_, cellIndex) => (
                        <TableCell key={`skeleton-${rowIndex}-${cellIndex}`} className="px-3 py-2 text-sm">
                          <Skeleton className="h-5 w-full" aria-hidden="true" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected?.() && 'selected'}
                      className="hover:bg-[#F4F5F7] data-[state=selected]:bg-[#DEEBFF]"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-3 py-2 text-sm">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
            </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Showing {from}–{to} of {total}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <label className="sr-only" htmlFor="datatable-pagesize">
            Rows per page
          </label>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
            disabled={loading}
          >
            <SelectTrigger id="datatable-pagesize" className="h-8 rounded-[3px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-[3px]"
            onClick={() => table.previousPage()}
            disabled={loading || !table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-[3px]"
            onClick={() => table.nextPage()}
            disabled={loading || !table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
      {loading ? <span className="sr-only" role="status">{loadingLabel}</span> : null}
    </div>
  );
}
