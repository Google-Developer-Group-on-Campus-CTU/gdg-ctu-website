import { useMemo, useState } from 'react';
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
} from '../../components/admin/shared.jsx';
import { MuiConfirmDialog } from '../../components/admin/form-shell.jsx';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';

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
        <Button
          type="button"
          variant="text"
          className="font-medium"
          style={{ textAlign: 'left' }}
          onClick={() => onView(row.original)}
          aria-label={`View message from ${row.original.name ?? row.original.email ?? 'sender'}`}
        >
          {row.original.subject?.trim() ? row.original.subject : '(no subject)'}
        </Button>
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
            <Button type="button" variant="outlined" size="small" onClick={() => onView(item)} aria-label={`View ${label}`}>
              View
            </Button>
            {status === 'new' ? (
              <Button type="button" variant="outlined" size="small" onClick={() => onMark(item, 'read')} aria-label={`Mark ${label} as read`}>
                Mark read
              </Button>
            ) : null}
            {status === 'new' || status === 'read' ? (
              <Button type="button" variant="outlined" size="small" onClick={() => onMark(item, 'replied')} aria-label={`Mark ${label} as replied`}>
                Mark replied
              </Button>
            ) : null}
            {status !== 'archived' ? (
              <Button type="button" variant="outlined" size="small" color="error" onClick={() => onMark(item, 'archived')} aria-label={`Archive ${label}`}>
                Archive
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outlined"
              size="small"
              color="error"
              onClick={() => onDelete(item)}
              aria-label={`Delete message from ${label}`}
            >
              Delete
            </Button>
          </span>
        );
      },
    },
  ], [onView, onMark, onDelete]);
}

function MessageDialog({ item, busy, onMark, onClose }) {
  const status = item ? statusOf(item) : 'new';
  const at = item ? receivedAt(item) : '';
  return (
    <Dialog
      open={!!item}
      onClose={busy ? undefined : onClose}
      aria-labelledby="message-dialog-title"
    >
      <DialogTitle id="message-dialog-title">{item?.subject?.trim() ? item.subject : '(no subject)'}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          From {item?.name ?? '(unnamed)'}{item?.email ? ` <${item.email}>` : ''} · {at ? new Date(at).toLocaleString() : 'unknown date'} ·{' '}
          <StatusPill status={status} />
        </DialogContentText>
        <p style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>{item?.message ?? '(empty message)'}</p>
      </DialogContent>
      <DialogActions style={{ marginTop: 8 }}>
        <Button type="button" variant="outlined" onClick={onClose} disabled={busy}>
          Close
        </Button>
        {status === 'new' ? (
          <Button
            type="button"
            variant="contained"
            onClick={() => onMark(item, 'read')}
            disabled={busy}
          >
            {busy ? 'Working…' : 'Mark read'}
          </Button>
        ) : null}
        {status === 'new' || status === 'read' ? (
          <Button
            type="button"
            variant="contained"
            onClick={() => onMark(item, 'replied')}
            disabled={busy}
          >
            {busy ? 'Working…' : 'Mark replied'}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
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
      {rowError ? <Alert severity="error" role="alert" sx={{ mb: 2 }}>{rowError}</Alert> : null}

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

      <MuiConfirmDialog
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
