import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getId, getUpdatedAt, messagesApi } from '../../api/resources.js';
import {
  timeAgo,
  useAdminList,
  useDebouncedValue,
} from '../../admin/editorial.js';
import { DataTable, DataTableColumnHeader } from '../../components/admin/data-table.jsx';
import {
  EmptyState,
  StatusPill,
  TypedConfirm,
} from '../../components/admin/shared.jsx';

/** Mirror of the Invites action-error wording for one-off row failures. */
function actionErrorMessage(err, fallback) {
  if (err?.status === 401) return 'You are signed out. Sign in again to continue.';
  if (err?.status === 403) return 'Account deactivated — contact tech/web officer.';
  const body = err?.body;
  const msg =
    typeof body === 'object' && body !== null ? (body.message ?? body.error) : null;
  return typeof msg === 'string' && msg ? msg : fallback;
}

const MESSAGE_STATUSES = ['new', 'read', 'replied', 'archived'];

function statusOf(item) {
  const raw = String(item?.status ?? 'new').trim().toLowerCase();
  return MESSAGE_STATUSES.includes(raw) ? raw : 'new';
}

function receivedAt(item) {
  return (
    item?.createdAt ??
    item?.created_at ??
    getUpdatedAt(item) ??
    ''
  );
}

const SCOPES = [
  { value: 'all', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'replied', label: 'Replied' },
  { value: 'archived', label: 'Archived' },
];

const ACTION_BTN_CLASS =
  'inline-flex h-10 items-center px-6 rounded-full border border-[var(--m3-outline)] bg-transparent text-[14px] font-medium tracking-[0.1px] text-[var(--m3-primary)] hover:bg-[rgba(11,87,208,0.08)]';

function useColumns({ onView, onMark, onDelete }) {
  return useMemo(() => [
    {
      id: 'from',
      accessorFn: (row) => row.name ?? row.email ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="From" />,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <span>
            <span className="font-medium">{item.name ?? '(unnamed)'}</span>
            {item.email ? (
              <span className="admin-muted" style={{ display: 'block' }}>{item.email}</span>
            ) : null}
          </span>
        );
      },
    },
    {
      accessorKey: 'subject',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Subject" />,
      cell: ({ row }) => (
        <button
          type="button"
          className="admin-link-btn font-medium"
          style={{ textAlign: 'left' }}
          onClick={() => onView(row.original)}
          aria-label={`View message from ${row.original.name ?? row.original.email ?? 'sender'}`}
        >
          {row.original.subject?.trim() ? row.original.subject : '(no subject)'}
        </button>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      enableSorting: false,
      cell: ({ row }) => <StatusPill status={statusOf(row.original)} />,
    },
    {
      id: 'received',
      accessorFn: (row) => receivedAt(row) ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Received" />,
      cell: ({ row }) => {
        const at = receivedAt(row.original);
        return <span title={at ? new Date(at).toLocaleString() : ''}>{timeAgo(at)}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;
        const id = getId(item);
        const status = statusOf(item);
        const label = item.name ?? item.email ?? 'message';
        if (!id || id === 'undefined') return <span className="admin-muted" aria-hidden="true">—</span>;
        return (
          <span className="admin-row-actions">
            <button type="button" className={ACTION_BTN_CLASS} onClick={() => onView(item)} aria-label={`View ${label}`}>
              View
            </button>
            {status === 'new' ? (
              <button type="button" className={ACTION_BTN_CLASS} onClick={() => onMark(item, 'read')} aria-label={`Mark ${label} as read`}>
                Mark read
              </button>
            ) : null}
            {status === 'new' || status === 'read' ? (
              <button type="button" className={ACTION_BTN_CLASS} onClick={() => onMark(item, 'replied')} aria-label={`Mark ${label} as replied`}>
                Mark replied
              </button>
            ) : null}
            {status !== 'archived' ? (
              <button type="button" className={`${ACTION_BTN_CLASS} admin-danger`} onClick={() => onMark(item, 'archived')} aria-label={`Archive ${label}`}>
                Archive
              </button>
            ) : null}
            <button
              type="button"
              className={`${ACTION_BTN_CLASS} admin-danger`}
              onClick={() => onDelete(item)}
              aria-label={`Delete message from ${label}`}
            >
              Delete
            </button>
          </span>
        );
      },
    },
  ], [onView, onMark, onDelete]);
}

function MessageDialog({ item, busy, onMark, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!item) return undefined;
    const node = dialogRef.current;
    node?.querySelector('button')?.focus();
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [item, onClose]);
  if (!item) return null;
  const status = statusOf(item);
  const at = receivedAt(item);
  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="message-dialog-title">{item.subject?.trim() ? item.subject : '(no subject)'}</h3>
        <p className="admin-muted">
          From {item.name ?? '(unnamed)'}{item.email ? ` <${item.email}>` : ''} · {at ? new Date(at).toLocaleString() : 'unknown date'} ·{' '}
          <StatusPill status={status} />
        </p>
        <p style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{item.message ?? '(empty message)'}</p>
        <div className="admin-dialog-actions" style={{ marginTop: 24 }}>
          <button type="button" className="gdg-btn gdg-btn-secondary" onClick={onClose} disabled={busy}>
            Close
          </button>
          {status === 'new' ? (
            <button
              type="button"
              className="gdg-btn gdg-btn-primary"
              onClick={() => onMark(item, 'read')}
              disabled={busy}
            >
              {busy ? 'Working…' : 'Mark read'}
            </button>
          ) : null}
          {status === 'new' || status === 'read' ? (
            <button
              type="button"
              className="gdg-btn gdg-btn-primary"
              onClick={() => onMark(item, 'replied')}
              disabled={busy}
            >
              {busy ? 'Working…' : 'Mark replied'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function AdminMessages() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const scope = params.get('scope') ?? 'all';
  const debounced = useDebouncedValue(q);
  const { data, loading, error, requestId, retry } = useAdminList(
    () => messagesApi.list().catch((e) => {
      if (e?.status === 404) return [];
      throw e;
    }),
    'messages',
  );

  const [viewing, setViewing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [rowError, setRowError] = useState(null);

  const rows = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    return (data ?? [])
      .slice()
      .sort((a, b) => new Date(receivedAt(b) ?? 0) - new Date(receivedAt(a) ?? 0))
      .filter((item) => {
        if (scope !== 'all' && statusOf(item) !== scope) return false;
        if (!term) return true;
        return [item.name, item.email, item.subject]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);
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

  const runMark = async (item, nextStatus) => {
    const id = getId(item);
    if (!id || id === 'undefined') return;
    setBusy(true);
    setRowError(null);
    try {
      await messagesApi.update(id, { status: nextStatus });
      setToast(`Marked as ${nextStatus}.`);
      if (viewing && String(getId(viewing)) === String(id)) {
        setViewing({ ...viewing, status: nextStatus });
      }
      retry();
    } catch (err) {
      setRowError(actionErrorMessage(err, `Could not mark as ${nextStatus}. Try again.`));
    } finally {
      setBusy(false);
    }
  };

  const runDelete = async () => {
    const id = confirmDelete ? getId(confirmDelete) : null;
    if (!id || id === 'undefined') {
      setConfirmDelete(null);
      return;
    }
    setBusy(true);
    try {
      await messagesApi.remove(id);
      setToast('Message deleted.');
      if (viewing && String(getId(viewing)) === String(id)) setViewing(null);
      setConfirmDelete(null);
      retry();
    } catch (err) {
      setRowError(actionErrorMessage(err, 'Could not delete the message. Try again.'));
      setBusy(false);
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const columns = useColumns({
    onView: (item) => {
      setRowError(null);
      setViewing(item);
    },
    onMark: runMark,
    onDelete: (item) => {
      setRowError(null);
      setConfirmDelete(item);
    },
  });

  return (
    <section aria-label="Contact inbox">
      <div className="admin-page-head">
        <div>
          <h1>Inbox</h1>
          <p className="admin-muted">Messages sent through the public contact form. Newest first.</p>
        </div>
      </div>

      {toast ? <p role="status" aria-live="polite" className="admin-muted">{toast}</p> : null}
      {rowError ? <div className="admin-notice admin-notice-error" role="alert">{rowError}</div> : null}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        loadingLabel="Loading messages…"
        error={error}
        requestId={requestId}
        onRetry={retry}
        searchColumnId="from"
        searchPlaceholder="Search by name, email, or subject…"
        searchValue={q}
        onSearchChange={setQuery}
        scopes={SCOPES}
        scopeColumnId="status"
        scopeValue={scope}
        onScopeChange={setScope}
        pageSizeOptions={[20, 10]}
        renderEmptyState={
          <EmptyState
            title={(data ?? []).length === 0 ? 'No messages yet' : 'No messages match this filter'}
            hint="Messages sent through the public contact form land here."
          />
        }
      />

      <MessageDialog
        item={viewing}
        busy={busy}
        onMark={runMark}
        onClose={() => { if (!busy) setViewing(null); }}
      />

      <TypedConfirm
        open={!!confirmDelete}
        title="Delete message?"
        body="This permanently deletes the message from the inbox. This cannot be undone."
        expected={confirmDelete?.email ?? confirmDelete?.name ?? ''}
        confirmLabel="Delete forever"
        busy={busy}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={runDelete}
      />
    </section>
  );
}
