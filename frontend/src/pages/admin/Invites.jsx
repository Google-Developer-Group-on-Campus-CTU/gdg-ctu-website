import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  adminInvitesApi,
  buildInviteLink,
  displayActor,
  formatWhen,
  inviteStatus,
} from '../../api/admin-invites.js';
import { timeAgo, useAdminList, useDebouncedValue } from '../../admin/editorial.js';
import { DataTable, DataTableColumnHeader } from '../../components/admin/data-table.jsx';
import { EmptyState, StatusPill } from '../../components/admin/shared.jsx';

/** Mirror of shared ErrorState wording for one-off action failures (create/revoke). */
function actionErrorMessage(err, fallback) {
  if (err?.status === 401) return 'You are signed out. Sign in again to continue.';
  if (err?.status === 403) return 'Account deactivated — contact tech/web officer.';
  const body = err?.body;
  const msg =
    typeof body === 'object' && body !== null ? (body.message ?? body.error) : null;
  return typeof msg === 'string' && msg ? msg : fallback;
}

function RevokeConfirm({ invite, busy, error, onCancel, onConfirm }) {
  if (!invite) return null;
  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="revoke-invite-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="revoke-invite-title">Revoke this invite?</h3>
        <p>
          The link stops working right away. Whoever received it won't be able to
          create an account with it — you can always generate a new invite.
        </p>
        <p className="admin-muted">
          Created {formatWhen(invite.createdAt)} · expires {formatWhen(invite.expiresAt)}
        </p>
        {error ? (
          <p className="admin-field-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="admin-dialog-actions">
          <button
            type="button"
            className="gdg-btn gdg-btn-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="gdg-btn gdg-btn-primary admin-danger"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Revoking…' : 'Revoke invite'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* 44px action target on the shared link-button language (DataTable owns the brutal wrapper). */
const REVOKE_BUTTON_CLASS =
  'admin-link-btn admin-link-btn-danger inline-flex min-h-[44px] items-center';

/* Static column defs: status · code · created · expires · role · used by ·
   created by. The Revoke action column is appended in-component (needs the
   `openRevoke` closure); no detail route exists for invites, so Revoke is
   the only row action. */
const baseColumns = [
  {
    id: 'status',
    accessorFn: (invite) => inviteStatus(invite),
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => <StatusPill status={inviteStatus(row.original)} />,
  },
  {
    accessorKey: 'id',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
    cell: ({ row }) => (
      <code className="font-mono text-xs" title={row.original.id}>
        {row.original.id}
      </code>
    ),
  },
  {
    id: 'created',
    accessorFn: (invite) => invite.createdAt ?? '',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
    cell: ({ row }) => (
      <span title={formatWhen(row.original.createdAt)}>{timeAgo(row.original.createdAt)}</span>
    ),
  },
  {
    id: 'expires',
    accessorFn: (invite) => invite.expiresAt ?? '',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Expires" />,
    cell: ({ row }) => formatWhen(row.original.expiresAt),
  },
  {
    id: 'role',
    // GET /admin-invites returns no per-invite role; every invite redeems to
    // an admin account, so the column renders that standing value.
    accessorFn: (invite) => invite.role ?? 'admin',
    header: 'Role',
    enableSorting: false,
    cell: ({ row }) => row.original.role ?? 'admin',
  },
  {
    id: 'usedBy',
    header: 'Used by',
    enableSorting: false,
    cell: ({ row }) => {
      const invite = row.original;
      return inviteStatus(invite) === 'used'
        ? `${displayActor(invite.usedBy)} · ${timeAgo(invite.usedAt)}`
        : '—';
    },
  },
  {
    id: 'createdBy',
    accessorFn: (invite) => displayActor(invite.createdBy),
    header: 'Created by',
    enableSorting: false,
    cell: ({ row }) => displayActor(row.original.createdBy),
  },
];

export default function AdminInvites() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const debounced = useDebouncedValue(q);
  const { data, loading, error, requestId, retry } = useAdminList(
    () => adminInvitesApi.list().then((payload) => payload?.invites ?? []),
    'admin-invites',
  );

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [justCreated, setJustCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copyHint, setCopyHint] = useState(null);
  const linkInputRef = useRef(null);

  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState(null);

  const rows = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    const sorted = [...(data ?? [])].sort(
      (a, b) => new Date(b?.createdAt ?? 0) - new Date(a?.createdAt ?? 0),
    );
    if (!term) return sorted;
    return sorted.filter((invite) =>
      [invite.id, displayActor(invite.createdBy), displayActor(invite.usedBy)]
        .filter((v) => v && v !== '—')
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [data, debounced]);

  const setQuery = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  const openRevoke = useCallback((invite) => {
    setRevokeError(null);
    setRevokeTarget(invite);
  }, []);

  // Static defs + one closure column: keeps table identity stable while the
  // Revoke button reaches page state. (No detail route exists for invites —
  // Revoke is the only row action.)
  const columns = useMemo(() => [
    ...baseColumns,
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const invite = row.original;
        if (inviteStatus(invite) === 'used') return <span className="admin-muted">—</span>;
        return (
          <button
            type="button"
            className={REVOKE_BUTTON_CLASS}
            onClick={() => openRevoke(invite)}
            aria-label={`Revoke invite ${invite.id}`}
          >
            Revoke
          </button>
        );
      },
    },
  ], [openRevoke]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    setCopyHint(null);
    setCopied(false);
    try {
      const invite = await adminInvitesApi.create();
      if (!invite?.token) {
        setCreateError('The server did not return an invite token. Try again.');
        return;
      }
      // Shown exactly once — the backend never returns the token again.
      setJustCreated({
        link: buildInviteLink(invite.token),
        expiresAt: invite.expiresAt ?? null,
      });
      retry();
    } catch (err) {
      setCreateError(actionErrorMessage(err, 'Could not create the invite. Try again.'));
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!justCreated) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(justCreated.link);
      setCopied(true);
      setCopyHint(null);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context) — select the field so Ctrl+C works.
      linkInputRef.current?.select();
      setCopyHint('Automatic copy is blocked here — the link is selected, press Ctrl+C.');
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      await adminInvitesApi.revoke(revokeTarget.id);
      setRevokeTarget(null);
      retry();
    } catch (err) {
      setRevokeError(actionErrorMessage(err, 'Could not revoke the invite.'));
    } finally {
      setRevoking(false);
    }
  };

  return (
    <section aria-label="Admin invites">
      <div className="admin-page-head">
        <div>
          <h1>Invites</h1>
          <p className="admin-muted">
            Single-use links that let someone create their own admin account.
          </p>
        </div>
        <button
          type="button"
          className="admin-new-btn"
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? 'Creating…' : '+ New invite'}
        </button>
      </div>

      {createError ? (
        <div className="admin-notice admin-notice-error" role="alert">
          {createError}
        </div>
      ) : null}

      {justCreated ? (
        <div className="admin-notice admin-notice-success" role="status">
          <h3>Invite created — copy the link now</h3>
          <p>
            The full link is shown only once. Share it with the officer; they can
            use it to create one admin account until it expires or is redeemed.
          </p>
          <div className="admin-invite-link-row">
            <input
              ref={linkInputRef}
              type="text"
              readOnly
              value={justCreated.link}
              aria-label="Invite link (shown once)"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button type="button" className="gdg-btn gdg-btn-primary" onClick={handleCopy}>
              {copied ? 'Copied ✓' : 'Copy link'}
            </button>
          </div>
          {copyHint ? <p>{copyHint}</p> : null}
          <p>
            Expires {formatWhen(justCreated.expiresAt)} ·{' '}
            <button
              type="button"
              className="admin-link-btn"
              onClick={() => {
                setJustCreated(null);
                setCopyHint(null);
                setCopied(false);
              }}
            >
              Done
            </button>
          </p>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        loadingLabel="Loading invites…"
        error={error}
        requestId={requestId}
        onRetry={retry}
        searchColumnId="id"
        searchPlaceholder="Search invites…"
        searchValue={q}
        onSearchChange={setQuery}
        pageSizeOptions={[20, 10]}
        renderEmptyState={
          <EmptyState
            title={(data ?? []).length === 0 ? 'No invites yet' : 'No invites match this filter'}
            hint="Create a single-use link so a new officer can set up their own admin account."
          />
        }
      />

      <RevokeConfirm
        invite={revokeTarget}
        busy={revoking}
        error={revokeError}
        onCancel={() => {
          if (revoking) return;
          setRevokeTarget(null);
          setRevokeError(null);
        }}
        onConfirm={handleRevoke}
      />
    </section>
  );
}
