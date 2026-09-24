import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authClient } from '../../lib/auth-client';
import { formatWhen } from '../../api/admin-invites.js';
import { timeAgo, useAdminList, useDebouncedValue } from '../../admin/editorial.js';
import { DataTable, DataTableColumnHeader } from '../../components/admin/data-table.jsx';
import { EmptyState, StatusPill } from '../../components/admin/shared.jsx';

/**
 * User accounts & access — backed entirely by Better Auth's admin plugin
 * client (`authClient.admin.*`), which calls the plugin's own endpoints
 * under `${VITE_API_URL}/api/auth/admin/*` with the cookie session. No
 * custom backend routes, no Authorization headers.
 *
 * Server contract (better-auth 1.7.5, dist/plugins/admin/routes.mjs):
 *   GET  /admin/list-users   { query: { limit, offset?, sortBy?, sortDirection? } } → { users, total }
 *   POST /admin/set-role     { userId, role }   → { user }
 *   POST /admin/ban-user     { userId, banReason? } → { user }
 *   POST /admin/unban-user   { userId }         → { user }
 *   POST /admin/remove-user  { userId }         → { success }
 *
 * Roles come from backend config (config/auth.ts): adminRoles = ["admin"],
 * defaultRole = "user".
 *
 * Row actions stay list-level (Make admin / Ban / Delete confirms live in
 * this page's dialog): no user detail route exists, so there is no Manage
 * pill to delegate to. See the Status section of docs/admin-data-table.md.
 */

/** Server-side cap on list-users (plugin `limit` param). */
const LIST_LIMIT = 50;

/* 44px action targets on the shared link-button language (DataTable owns the brutal wrapper). */
const ROW_BUTTON_CLASS = 'admin-link-btn inline-flex min-h-[44px] items-center';
const ROW_BUTTON_DANGER_CLASS = 'admin-link-btn admin-link-btn-danger inline-flex min-h-[44px] items-center';

/**
 * better-auth's client resolves — it does not throw — on HTTP errors:
 * `{ data, error }`. Normalize both failure paths (returned error object or
 * a rejected promise) into an Error carrying `.status` + `.body`, which is
 * the contract ErrorState and actionErrorMessage already read.
 */
function asError(err, fallback) {
  if (err instanceof Error && (err.status !== undefined || err.body !== undefined)) return err;
  const message =
    (typeof err?.message === 'string' && err.message) ||
    (typeof err?.error === 'string' && err.error) ||
    fallback;
  const error = new Error(message);
  const status = Number(err?.status);
  if (Number.isFinite(status) && status > 0) error.status = status;
  error.body = { message, error: message };
  return error;
}

/** Await a plugin call and throw a normalized error when it fails. */
async function unwrap(promise, fallback) {
  let res;
  try {
    res = await promise;
  } catch (err) {
    throw asError(err, fallback);
  }
  if (res?.error) throw asError(res.error, fallback);
  if (res?.data === null || res?.data === undefined) throw asError(null, fallback);
  return res.data;
}

/** Mirror of shared ErrorState wording for one-off action failures. */
function actionErrorMessage(err, fallback) {
  if (err?.status === 401) return 'You are signed out. Sign in again to continue.';
  if (err?.status === 403) return 'Account deactivated — contact tech/web officer.';
  const body = err?.body;
  const msg =
    typeof body === 'object' && body !== null ? (body.message ?? body.error) : null;
  return typeof msg === 'string' && msg ? msg : fallback;
}

/**
 * Banned means the flag is set AND any ban window hasn't lapsed — the
 * plugin leaves `banned` set after `banExpires` passes until an unban.
 */
function isBanned(user) {
  if (!user?.banned) return false;
  const expires = user.banExpires ? new Date(user.banExpires) : null;
  if (!expires || Number.isNaN(expires.getTime())) return true;
  return expires.getTime() > Date.now();
}

/** Per-action confirm-dialog copy (RevokeConfirm pattern from Invites). */
function actionCopy(action, user) {
  const name = user?.name || user?.email || 'This account';
  switch (action) {
    case 'promote':
      return {
        title: 'Grant admin access?',
        body: `${name} will be able to manage site content, media, invites, and other accounts.`,
        confirm: 'Make admin',
        busy: 'Promoting…',
        danger: false,
        fail: 'Could not change the role. Try again.',
      };
    case 'demote':
      return {
        title: 'Remove admin access?',
        body: `${name} will lose access to the admin area until someone grants the role again.`,
        confirm: 'Make user',
        busy: 'Removing access…',
        danger: true,
        fail: 'Could not change the role. Try again.',
      };
    case 'ban':
      return {
        title: 'Ban this account?',
        body: `${name} will be signed out everywhere and cannot sign in until unbanned.`,
        confirm: 'Ban account',
        busy: 'Banning…',
        danger: true,
        fail: 'Could not ban the account. Try again.',
      };
    case 'remove':
      return {
        title: 'Delete this account?',
        body: `This permanently deletes ${name} and all of their sessions. This cannot be undone.`,
        confirm: 'Delete account',
        busy: 'Deleting…',
        danger: true,
        fail: 'Could not delete the account. Try again.',
      };
    default:
      return {
        title: 'Are you sure?',
        body: '',
        confirm: 'Confirm',
        busy: 'Working…',
        danger: true,
        fail: 'Request failed. Try again.',
      };
  }
}

function UserActionConfirm({ target, busy, error, onCancel, onConfirm }) {
  if (!target) return null;
  const copy = actionCopy(target.action, target.user);
  return (
    <div className="admin-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="user-action-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="user-action-title">{copy.title}</h3>
        <p>{copy.body}</p>
        <p className="admin-muted">{target.user.email}</p>
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
            className={copy.danger ? 'gdg-btn gdg-btn-primary admin-danger' : 'gdg-btn gdg-btn-primary'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? copy.busy : copy.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Shared column defs: email · role · status · joined. The name column (needs
   the self-row marker) and the actions column (needs the confirm/unban
   closures) are appended in-component. */
const baseColumns = [
  {
    accessorKey: 'email',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    cell: ({ row }) => row.original.email ?? '—',
  },
  {
    id: 'role',
    accessorFn: (user) => user.role ?? 'user',
    header: 'Role',
    enableSorting: false,
    cell: ({ row }) => <StatusPill status={row.original.role ?? 'user'} />,
  },
  {
    id: 'status',
    header: 'Status',
    enableSorting: false,
    cell: ({ row }) => {
      const user = row.original;
      const banned = isBanned(user);
      return (
        <span title={banned ? (user.banReason ?? 'Banned') : undefined}>
          <StatusPill
            status={
              banned ? 'banned' : user.emailVerified ? 'verified' : 'unverified'
            }
          />
        </span>
      );
    },
  },
  {
    id: 'joined',
    accessorFn: (user) => user.createdAt ?? '',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Joined" />,
    cell: ({ row }) => (
      <span title={formatWhen(row.original.createdAt)}>{timeAgo(row.original.createdAt)}</span>
    ),
  },
];

export default function AdminUsers() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const debounced = useDebouncedValue(q);
  const { data: session } = authClient.useSession();
  const myId = session?.user?.id;

  const { data, loading, error, requestId, retry } = useAdminList(
    async () => {
      const payload = await unwrap(
        authClient.admin.listUsers({
          query: { limit: LIST_LIMIT, sortBy: 'createdAt', sortDirection: 'desc' },
        }),
        'Could not load accounts.',
      );
      return {
        users: Array.isArray(payload.users) ? payload.users : [],
        total: Number(payload.total) || 0,
      };
    },
    'admin-users',
  );

  const users = useMemo(() => {
    if (Array.isArray(data)) return data; // useAdminList's initialData: []
    return Array.isArray(data?.users) ? data.users : [];
  }, [data]);
  const total = data?.total ?? users.length;

  const [target, setTarget] = useState(null); // { user, action }
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [unbanningId, setUnbanningId] = useState(null);
  const [pageActionError, setPageActionError] = useState(null);

  const rows = useMemo(() => {
    const term = debounced.trim().toLowerCase();
    const sorted = [...users].sort(
      (a, b) => new Date(b?.createdAt ?? 0) - new Date(a?.createdAt ?? 0),
    );
    if (!term) return sorted;
    return sorted.filter((user) =>
      [user.name, user.email, user.role ?? 'user']
        .filter((v) => v && v !== '—')
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [users, debounced]);

  /** Never open an action against your own row. */
  const openConfirm = useCallback((user, action) => {
    if (!user || user.id === myId) return;
    setPageActionError(null);
    setActionError(null);
    setTarget({ user, action });
  }, [myId]);

  const handleUnban = useCallback(async (user) => {
    if (!user || user.id === myId) return;
    setPageActionError(null);
    setUnbanningId(user.id);
    try {
      await unwrap(authClient.admin.unbanUser({ userId: user.id }), 'Could not lift the ban.');
      retry();
    } catch (err) {
      setPageActionError(actionErrorMessage(err, 'Could not lift the ban.'));
    } finally {
      setUnbanningId(null);
    }
  }, [myId, retry]);

  const columns = useMemo(() => [
    {
      id: 'name',
      accessorFn: (user) => user.name ?? user.email ?? '',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <span>
          {row.original.name || '—'}
          {row.original.id === myId ? <span className="admin-muted"> (you)</span> : null}
        </span>
      ),
    },
    ...baseColumns,
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const user = row.original;
        const self = user.id === myId;
        const banned = isBanned(user);
        const role = user.role ?? 'user';
        if (self) {
          return (
            <span className="admin-muted" title="You can't change your own account here.">
              —
            </span>
          );
        }
        return (
          <span className="admin-row-actions">
            {role !== 'admin' ? (
              <button type="button" className={ROW_BUTTON_CLASS} onClick={() => openConfirm(user, 'promote')}>
                Make admin
              </button>
            ) : (
              <button type="button" className={ROW_BUTTON_DANGER_CLASS} onClick={() => openConfirm(user, 'demote')}>
                Make user
              </button>
            )}
            {banned ? (
              <button
                type="button"
                className={ROW_BUTTON_CLASS}
                onClick={() => handleUnban(user)}
                disabled={unbanningId === user.id}
              >
                {unbanningId === user.id ? 'Unbanning…' : 'Unban'}
              </button>
            ) : (
              <button type="button" className={ROW_BUTTON_DANGER_CLASS} onClick={() => openConfirm(user, 'ban')}>
                Ban
              </button>
            )}
            <button type="button" className={ROW_BUTTON_DANGER_CLASS} onClick={() => openConfirm(user, 'remove')}>
              Delete
            </button>
          </span>
        );
      },
    },
  ], [myId, openConfirm, handleUnban, unbanningId]);

  const setQuery = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  const handleConfirm = async () => {
    if (!target || busy) return;
    const { user, action } = target;
    // Double guard: self-rows never reach a plugin call (setRole has no
    // server-side self-check; ban/remove do).
    if (user.id === myId) {
      setTarget(null);
      return;
    }
    const copy = actionCopy(action, user);
    setBusy(true);
    setActionError(null);
    try {
      if (action === 'promote') {
        await unwrap(authClient.admin.setRole({ userId: user.id, role: 'admin' }), copy.fail);
      } else if (action === 'demote') {
        await unwrap(authClient.admin.setRole({ userId: user.id, role: 'user' }), copy.fail);
      } else if (action === 'ban') {
        const actor = session?.user?.name || session?.user?.email || 'an administrator';
        await unwrap(
          authClient.admin.banUser({ userId: user.id, banReason: `Banned by ${actor}` }),
          copy.fail,
        );
      } else if (action === 'remove') {
        await unwrap(authClient.admin.removeUser({ userId: user.id }), copy.fail);
      }
      setTarget(null);
      retry();
    } catch (err) {
      setActionError(actionErrorMessage(err, copy.fail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Admin users">
      <div className="admin-page-head">
        <div>
          <h1>Users</h1>
          <p className="admin-muted">
            Accounts that can sign in. Roles control admin access; bans block sign-in entirely.
          </p>
        </div>
      </div>

      {pageActionError ? (
        <div className="admin-notice admin-notice-error" role="alert">
          {pageActionError}
        </div>
      ) : null}

      {!loading && !error && total > users.length ? (
        <p className="admin-muted">
          Showing {users.length} of {total} accounts (loading is capped at {LIST_LIMIT}).
        </p>
      ) : null}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        loadingLabel="Loading accounts…"
        error={error}
        requestId={requestId}
        onRetry={retry}
        searchColumnId="name"
        searchPlaceholder="Search name, email, or role…"
        searchValue={q}
        onSearchChange={setQuery}
        pageSizeOptions={[20, 10]}
        renderEmptyState={
          users.length === 0 ? (
            <EmptyState
              title="No accounts yet"
              hint="Accounts appear here as soon as someone registers — or send an invite so an officer can set up their own."
            />
          ) : (
            <EmptyState
              title="No matches"
              hint={`No accounts match “${debounced}”.`}
            />
          )
        }
      />

      <UserActionConfirm
        target={target}
        busy={busy}
        error={actionError}
        onCancel={() => {
          if (busy) return;
          setTarget(null);
          setActionError(null);
        }}
        onConfirm={handleConfirm}
      />
    </section>
  );
}
