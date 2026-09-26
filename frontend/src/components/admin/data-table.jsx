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
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Skeleton from '@mui/material/Skeleton';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import { MuiSearchField } from './mui-fields.jsx';

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
      variant="text"
      size="small"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className="-ml-3 flex h-12 min-h-[48px] min-w-[48px] items-center gap-2 rounded-full px-3 text-[14px] leading-5 font-medium"
      sx={{ minWidth: 48, color: 'var(--m3-on-surface-variant)' }}
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
      <CardContent sx={{ padding: 0, '&:last-child': { paddingBottom: 0 } }}>
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span
            className="flex size-12 items-center justify-center rounded-full bg-[var(--m3-secondary-container)] text-[var(--m3-on-secondary-container)]"
            aria-hidden="true"
          >
            <Search className="size-6" aria-hidden="true" />
          </span>
          <p className="font-heading text-[22px] leading-7 font-normal text-[var(--m3-on-surface)]">{title}</p>
          {hint ? <p className="text-sm text-[var(--m3-on-surface-variant)] max-w-[40ch]">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function DefaultErrorState({ error, onRetry, requestId }) {
  return (
    <Card className={WRAPPER_CLASS}>
      <CardContent sx={{ padding: 0, '&:last-child': { paddingBottom: 0 } }}>
        <div className="flex flex-col items-start gap-3 py-8 px-4">
          <div role="alert" className="flex flex-col gap-1">
            <p className="font-heading text-[16px] font-medium text-[var(--m3-on-surface)]">Something went wrong</p>
            <p className="text-sm text-[var(--m3-on-surface-variant)]">{friendlyTableError(error)}</p>
            {requestId ? (
              <p className="text-xs text-[var(--m3-on-surface-variant)]">Request ID: {requestId}</p>
            ) : null}
          </div>
          {onRetry ? (
            <Button type="button" variant="outlined" size="small" className="rounded-full" onClick={onRetry}>
              Retry
            </Button>
          ) : null}
        </div>
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

  // Clamp the page after deletions shrink the result set, so the footer
  // never strands the user on an empty page.
  const maxPageIndex = Math.max(0, Math.ceil(total / pageSize) - 1);
  useEffect(() => {
    if (pageIndex > maxPageIndex) {
      table.setPageIndex(maxPageIndex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex, maxPageIndex]);

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
  const sortedPageSizeOptions = [...pageSizeOptions].sort((a, b) => a - b);

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
        <div className="min-w-52 flex-1 sm:max-w-[320px]">
          <MuiSearchField
            id={`datatable-search-${searchColumnId}`}
            label={searchPlaceholder}
            value={activeSearch}
            disabled={loading}
            onChange={handleSearch}
          />
        </div>
        {showScope ? (
          <FormControl size="small" disabled={loading}>
            <InputLabel id="datatable-scope-label" className="sr-only">
              {scopeLabel}
            </InputLabel>
            <Select
              id="datatable-scope"
              labelId="datatable-scope-label"
              value={activeScope}
              label={scopeLabel}
              displayEmpty
              renderValue={(selected) =>
                scopes.find((option) => option.value === selected)?.label ?? scopePlaceholder
              }
              onChange={(e) => handleScope(e.target.value)}
            >
              {scopes.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}
        <span className="text-[12px] font-medium tracking-[0.5px] text-[var(--m3-on-surface-variant)]" aria-live="polite">
          {loading ? loadingLabel : `${total} result${total === 1 ? '' : 's'}`}
        </span>
      </div>

      {!loading && visibleRows.length === 0 ? (
        renderEmptyState ?? <DefaultEmptyState title={emptyTitle} hint={emptyHint} />
      ) : (
        <div className={WRAPPER_CLASS}>
          {/* Single keyboard-reachable scroll region for this table:
              TableContainer is the scroller; TablePagination stays outside
              it below. Do not add another scroll container here. */}
          <TableContainer
            role="region"
            aria-label="Table results"
            tabIndex={0}
            sx={{ overscrollBehavior: 'contain', maxWidth: '100%' }}
          >
            <Table>
              <caption className="sr-only">Table results</caption>
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} sx={{ height: 56 }}>
                    {headerGroup.headers.map((header) => {
                      const sortable = header.column.getCanSort();
                      const sorted = header.column.getIsSorted();
                      return (
                        <TableCell
                          key={header.id}
                          scope="col"
                          sx={{ height: 56 }}
                          {...(sortable
                            ? {
                                'aria-sort': sorted
                                  ? sorted === 'asc'
                                    ? 'ascending'
                                    : 'descending'
                                  : 'none',
                              }
                            : {})}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {loading
                  ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                      <TableRow key={`skeleton-${rowIndex}`} sx={{ height: 52 }}>
                        {Array.from({ length: columnCount }).map((_, cellIndex) => (
                          <TableCell key={`skeleton-${rowIndex}-${cellIndex}`} sx={{ paddingTop: 0, paddingBottom: 0 }}>
                            <Skeleton variant="rounded" width="100%" height={16} aria-hidden="true" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : visibleRows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected?.() && 'selected'}
                        sx={{ height: 52 }}
                        className="border-b border-[var(--m3-outline-variant)] last:border-0 hover:bg-[color-mix(in_srgb,var(--m3-on-surface)_8%,transparent)] data-[state=selected]:bg-[var(--m3-surface-container-highest)] [&[aria-disabled=true]]:text-[color-mix(in_srgb,var(--m3-on-surface)_38%,transparent)]"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} sx={{ paddingTop: 0, paddingBottom: 0 }}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      )}

      <div className="mt-4 flex min-h-[52px] flex-wrap items-center">
        <TablePagination
          component="div"
          sx={{ marginLeft: 'auto', maxWidth: '100%' }}
          count={total}
          page={Math.min(pageIndex, maxPageIndex)}
          rowsPerPage={pageSize}
          rowsPerPageOptions={sortedPageSizeOptions}
          labelRowsPerPage="Rows per page"
          labelDisplayedRows={({ from: labelFrom, to: labelTo, count: labelCount }) =>
            `Showing ${labelCount === 0 ? 0 : labelFrom}–${labelTo} of ${labelCount}`
          }
          slotProps={{ displayedRows: { 'aria-live': 'polite' } }}
          showFirstButton={false}
          showLastButton={false}
          getItemAriaLabel={(type) =>
            type === 'previous' ? 'Previous' : type === 'next' ? 'Next' : type
          }
          disabled={loading}
          onPageChange={(_e, nextPage) => table.setPageIndex(nextPage)}
          onRowsPerPageChange={(e) => {
            table.setPageSize(parseInt(e.target.value, 10));
            table.setPageIndex(0);
          }}
        />
      </div>
      {loading ? <span className="sr-only" role="status">{loadingLabel}</span> : null}
    </div>
  );
}
