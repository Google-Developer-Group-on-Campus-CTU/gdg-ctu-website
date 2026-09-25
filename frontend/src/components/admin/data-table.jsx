import { useEffect, useState } from 'react';
import { flexRender } from '@tanstack/react-table';
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

const WRAPPER_CLASS =
  'overflow-hidden rounded-[4px] border border-[var(--m3-outline-variant)] bg-[var(--m3-surface)]';

const ALL = 'all';

function friendlyTableError(error) {
  if (!error) return 'Could not load this content.';
  if (error.status === 401) return 'You are signed out. Sign in again to continue.';
  if (error.status === 403) return 'Account deactivated — contact tech/web officer.';
  if (error.status === 404) return 'This backend module is not deployed yet.';
  return error?.body?.message ?? error?.message ?? 'Could not load this content.';
}

export function DataTableColumnHeader({ column, title }) {
  if (!column.getCanSort()) return <span className="text-[14px] leading-5 font-medium text-[var(--m3-on-surface-variant)]">{title}</span>;
  const sorted = column.getIsSorted();
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className="-ml-3 flex h-12 min-h-[48px] min-w-[48px] items-center gap-2 rounded-full px-3 text-[14px] leading-5 font-medium"
      aria-label={`Sort by ${title}${sorted === 'asc' ? ' (sorted ascending)' : sorted === 'desc' ? ' (sorted descending)' : ''}`}
    >
      {title}
      <Icon
        className={`size-[18px] shrink-0 ${sorted ? 'text-[var(--m3-primary)]' : 'text-[var(--m3-on-surface-variant)]'}`}
        aria-hidden="true"
      />
    </Button>
  );
}

function DefaultEmptyState({ title, hint }) {
  return (
    <Card className={WRAPPER_CLASS}>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <span
          className="flex size-12 items-center justify-center rounded-full bg-[var(--m3-secondary-container)] text-[var(--m3-on-secondary-container)]"
          aria-hidden="true"
        >
          <Search className="size-6" />
        </span>
        <p className="font-heading text-[22px] leading-7 font-normal text-[var(--m3-on-surface)]">{title}</p>
        {hint ? <p className="text-sm text-[var(--m3-on-surface-variant)] max-w-[40ch]">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function DefaultErrorState({ error, onRetry, requestId }) {
  return (
    <Card className={WRAPPER_CLASS}>
      <CardContent className="flex flex-col items-start gap-3 py-8">
        <div role="alert" className="flex flex-col gap-1">
          <p className="font-heading text-[16px] font-medium text-[var(--m3-on-surface)]">Something went wrong</p>
          <p className="text-sm text-[var(--m3-on-surface-variant)]">{friendlyTableError(error)}</p>
          {requestId ? (
            <p className="text-xs text-[var(--m3-on-surface-variant)]">Request ID: {requestId}</p>
          ) : null}
        </div>
        {onRetry ? (
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DataTable({
  columns,
  data = [],
  loading = false,
  error = null,
  onRetry,
  searchColumnId = 'title',
  searchPlaceholder = 'Search…',
  searchValue,
  onSearchChange,
  scopes = [],
  scopeColumnId = 'scope',
  scopeValue,
  onScopeChange,
  scopePlaceholder = 'All scopes',
  scopeLabel = 'Filter by scope',
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
      <div className="mb-4 flex flex-wrap items-center gap-3" role="search">
        <div className="relative min-w-52 flex-1 sm:max-w-[320px]">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-[var(--m3-on-surface-variant)]"
            aria-hidden="true"
          />
          <label className="sr-only" htmlFor={`datatable-search-${searchColumnId}`}>
            {searchPlaceholder}
          </label>
          <Input
            id={`datatable-search-${searchColumnId}`}
            type="search"
            className="h-10 rounded-full bg-[var(--m3-surface-container-high)] border-transparent pr-4 pl-12 text-[14px] placeholder:text-[var(--m3-on-surface-variant)]"
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
                className="h-10 rounded-full border-[var(--m3-outline)] bg-transparent px-4"
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
        <span className="text-[12px] font-medium tracking-[0.5px] text-[var(--m3-on-surface-variant)]" aria-live="polite">
          {loading ? loadingLabel : `${total} result${total === 1 ? '' : 's'}`}
        </span>
      </div>

      {!loading && visibleRows.length === 0 ? (
        renderEmptyState ?? <DefaultEmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <div className={WRAPPER_CLASS}>
          {/* NOTE: ui/table.tsx also renders an overflow-x-auto wrapper around
              <table>; this outer region is the single keyboard-reachable scroll
              region for this table. Do not add another scroll container here —
              remove the inner one in table.tsx instead (out of scope for this file). */}
          <div
            className="overflow-x-auto [overscroll-behavior:contain]"
            role="region"
            aria-label="Table results"
            tabIndex={0}
          >
            <Table>
            <caption className="sr-only">Table results</caption>
            <TableHeader className="border-b border-[var(--m3-outline-variant)] bg-[var(--m3-surface-container)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="h-14 hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    const sortable = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    return (
                      <TableHead
                        key={header.id}
                        scope="col"
                        className="h-14 px-4 text-[14px] leading-5 font-medium text-[var(--m3-on-surface-variant)]"
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
                    <TableRow key={`skeleton-${rowIndex}`} className="h-[52px] hover:bg-transparent">
                      {Array.from({ length: columnCount }).map((_, cellIndex) => (
                        <TableCell key={`skeleton-${rowIndex}-${cellIndex}`} className="px-4 py-0">
                          <Skeleton className="h-4 w-full rounded-full" aria-hidden="true" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : visibleRows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected?.() && 'selected'}
                      className="h-[52px] border-b border-[var(--m3-outline-variant)] last:border-0 hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_8%,transparent)] data-[state=selected]:bg-[var(--m3-surface-container-highest)] [&[aria-disabled=true]]:text-[color-mix(in_srgb,var(--m3-on-surface)_38%,transparent)]"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-4 py-0 text-[14px] leading-5 text-[var(--m3-on-surface)]">
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

      <div className="mt-4 flex min-h-[52px] flex-wrap items-center gap-3">
        <p className="text-[12px] leading-4 font-medium text-[var(--m3-on-surface-variant)]" aria-live="polite">
          Showing {from}–{to} of {total}
        </p>
        <div className="ml-auto flex items-center gap-2" role="group" aria-label="Pagination">
          <label className="sr-only" htmlFor="datatable-pagesize">
            Rows per page
          </label>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
            disabled={loading}
          >
            <SelectTrigger id="datatable-pagesize" className="h-10 rounded-full border-[var(--m3-outline)]">
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
            className="rounded-full"
            onClick={() => table.previousPage()}
            disabled={loading || !table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
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
