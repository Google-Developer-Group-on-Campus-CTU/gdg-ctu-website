import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { authClient } from '../../lib/auth-client';
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
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';

/**
 * User accounts & access — backed entirely by Better Auth's admin plugin
 * client (`authClient.admin.*`), which calls the plugin's own endpoints
 * under `${VITE_API_URL}/api/auth/admin/*` with the cookie session. No
 * custom backend routes, no Authorization headers.
 *
 * Server contract (better-auth 1.7.5, dist/plugins/admin/routes.mjs):
 *   GET  /admin/list-users   { query: { limit, offset?, sortBy?, sortDirection? } } → { users, total }
 *   POST /admin/create-user  { email, name, password?, role? } → { user }
 *   POST /admin/set-role     { userId, role }   → { user }
 *   POST /admin/ban-user     { userId, banReason? } → { user }
 *   POST /admin/unban-user   { userId }         → { user }
 *   POST /admin/remove-user  { userId }         → { success }
 *
 * Pending invites share this page (the standalone /admin/invites route is
 * retired): POST/GET/DELETE /admin-invites via api/admin-invites.js, with the
 * one-time link shown once after creation.
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
    <Dialog
      open
      onClose={busy ? undefined : onCancel}
      aria-labelledby="user-action-title"
    >
      <DialogTitle id="user-action-title">{copy.title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{copy.body}</DialogContentText>
        <DialogContentText>{target.user.email}</DialogContentText>
        {error ? (
          <Alert severity="error" role="alert" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          type="button"
          variant="outlined"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="contained"
          color={copy.danger ? 'error' : 'primary'}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? copy.busy : copy.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Add / Invite composer. Two modes in one dialog:
 * (a) Add user directly — email + name + temporary password + role, created
 *     immediately via the Better Auth admin plugin
 *     (`authClient.admin.createUser` → POST /admin/create-user).
 * (b) Invite — generates a single-use link (POST /admin-invites) the officer
 *     redeems at /admin/register (every invite redeems to role=admin).
 */
function InviteComposer({
  mode, onModeChange,
  addFields, onAddField, onAddSubmit, addBusy, addError,
  onInviteSubmit, inviteBusy, inviteError,
  onClose,
}) {
  return (
    <Dialog
      open
      onClose={addBusy || inviteBusy ? undefined : onClose}
      aria-labelledby="add-invite-title"
    >
      <DialogTitle id="add-invite-title">Add or invite an officer</DialogTitle>
      <DialogContent>
        <div className="admin-btn-row" role="group" aria-label="Choose how to onboard">
          <Button
            type="button"
            variant={mode === 'add' ? 'contained' : 'outlined'}
            onClick={() => onModeChange('add')}
            disabled={addBusy || inviteBusy}
          >
            Add user directly
          </Button>
          <Button
            type="button"
            variant={mode === 'invite' ? 'contained' : 'outlined'}
            onClick={() => onModeChange('invite')}
            disabled={addBusy || inviteBusy}
          >
            Invite via link
          </Button>
        </div>
        {mode === 'add' ? (
          <>
            <DialogContentText>
              Creates the account right away with a temporary password — share it
              privately and ask them to change it after signing in.
            </DialogContentText>
            <TextField
              label="Name"
              type="text"
              fullWidth
              margin="dense"
              variant="outlined"
              value={addFields.name}
              onChange={(e) => onAddField('name', e.target.value)}
              autoComplete="off"
              disabled={addBusy}
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="dense"
              variant="outlined"
              value={addFields.email}
              onChange={(e) => onAddField('email', e.target.value)}
              autoComplete="off"
              disabled={addBusy}
            />
            <TextField
              label="Temporary password (min 8 characters)"
              type="password"
              fullWidth
              margin="dense"
              variant="outlined"
              value={addFields.password}
              onChange={(e) => onAddField('password', e.target.value)}
              autoComplete="new-password"
              disabled={addBusy}
            />
            <TextField
              label="Role"
              select
              fullWidth
              margin="dense"
              variant="outlined"
              value={addFields.role}
              onChange={(e) => onAddField('role', e.target.value)}
              disabled={addBusy}
            >
              <MenuItem value="user">user</MenuItem>
              <MenuItem value="admin">admin</MenuItem>
            </TextField>
            {addError ? (
              <Alert severity="error" role="alert" sx={{ mt: 2 }}>
                {addError}
              </Alert>
            ) : null}
          </>
        ) : (
          <>
            <DialogContentText>
              Generates a single-use link (expires in 72 hours) that lets the
              officer create their own admin account at /admin/register.
            </DialogContentText>
            {inviteError ? (
              <Alert severity="error" role="alert" sx={{ mt: 2 }}>
                {inviteError}
              </Alert>
            ) : null}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          type="button"
          variant="outlined"
          onClick={onClose}
          disabled={mode === 'add' ? addBusy : inviteBusy}
        >
          Cancel
        </Button>
        {mode === 'add' ? (
          <Button
            type="button"
            variant="contained"
            onClick={onAddSubmit}
            disabled={addBusy}
          >
            {addBusy ? 'Creating…' : 'Create account'}
          </Button>
        ) : (
          <Button
            type="button"
            variant="contained"
            onClick={onInviteSubmit}
            disabled={inviteBusy}
          >
            {inviteBusy ? 'Creating…' : 'Generate invite'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function InviteRevokeConfirm({ invite, busy, error, onCancel, onConfirm }) {
  if (!invite) return null;
  return (
    <Dialog
      open
      onClose={busy ? undefined : onCancel}
      aria-labelledby="revoke-invite-title"
    >
      <DialogTitle id="revoke-invite-title">Revoke this invite?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          The link stops working right away. Whoever received it won&apos;t be able to
          create an account with it — you can always generate a new invite.
        </DialogContentText>
        <DialogContentText>
          Created {formatWhen(invite.createdAt)} · expires {formatWhen(invite.expiresAt)}
        </DialogContentText>
        {error ? (
          <Alert severity="error" role="alert" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          type="button"
          variant="outlined"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="contained"
          color="error"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? 'Revoking…' : 'Revoke invite'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* Pending-invites table columns: status · code · created · expires · role ·
   used by · created by. Revoke is the only row action (appended in-component)
   and never shows for used invites. */
const inviteBaseColumns = [
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

  // Pending invites live on this page now (the standalone /admin/invites
  // route is retired). Same contract as before: list + one-time token.
  const {
    data: invitesData,
    loading: invitesLoading,
    error: invitesError,
    requestId: invitesRequestId,
    retry: retryInvites,
  } = useAdminList(
    () => adminInvitesApi.list().then((payload) => payload?.invites ?? []),
    'admin-invites',
  );
  const [composer, setComposer] = useState(null); // { mode: 'add' | 'invite' }
  const [addFields, setAddFields] = useState({ name: '', email: '', password: '', role: 'user' });
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [justCreated, setJustCreated] = useState(null); // { link, expiresAt }
  const [copied, setCopied] = useState(false);
  const [copyHint, setCopyHint] = useState(null);
  const linkInputRef = useRef(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState(null);

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
              <Button type="button" variant="outlined" size="small" onClick={() => openConfirm(user, 'promote')}>
                Make admin
              </Button>
            ) : (
              <Button type="button" variant="outlined" size="small" color="error" onClick={() => openConfirm(user, 'demote')}>
                Make user
              </Button>
            )}
            {banned ? (
              <Button
                type="button"
                variant="outlined"
                size="small"
                onClick={() => handleUnban(user)}
                disabled={unbanningId === user.id}
              >
                {unbanningId === user.id ? 'Unbanning…' : 'Unban'}
              </Button>
            ) : (
              <Button type="button" variant="outlined" size="small" color="error" onClick={() => openConfirm(user, 'ban')}>
                Ban
              </Button>
            )}
            <Button type="button" variant="outlined" size="small" color="error" onClick={() => openConfirm(user, 'remove')}>
              Delete
            </Button>
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

  const invites = useMemo(() => {
    const sorted = [...(invitesData ?? [])].sort(
      (a, b) => new Date(b?.createdAt ?? 0) - new Date(a?.createdAt ?? 0),
    );
    return sorted;
  }, [invitesData]);

  const openComposer = useCallback((mode) => {
    setAddError(null);
    setInviteError(null);
    setComposer({ mode: mode === 'invite' ? 'invite' : 'add' });
  }, []);

  const closeComposer = useCallback(() => {
    if (addBusy || inviteBusy) return;
    setComposer(null);
    setAddError(null);
    setInviteError(null);
  }, [addBusy, inviteBusy]);

  const setAddField = useCallback((key, value) => {
    setAddFields((prev) => ({ ...prev, [key]: value }));
    setAddError(null);
  }, []);

  /** Direct add via the Better Auth admin plugin (POST /admin/create-user). */
  const handleAddSubmit = useCallback(async () => {
    const name = String(addFields.name ?? '').trim();
    const email = String(addFields.email ?? '').trim();
    const password = String(addFields.password ?? '');
    const role = addFields.role === 'admin' ? 'admin' : 'user';
    if (!name) { setAddError('Name is required.'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setAddError('A valid email is required.'); return; }
    if (password.length < 8) { setAddError('Temporary password must be at least 8 characters.'); return; }
    setAddBusy(true);
    setAddError(null);
    try {
      await unwrap(
        authClient.admin.createUser({ name, email, password, role }),
        'Could not create the account. Try again.',
      );
      setComposer(null);
      setAddFields({ name: '', email: '', password: '', role: 'user' });
      retry();
    } catch (err) {
      setAddError(actionErrorMessage(err, 'Could not create the account. Try again.'));
    } finally {
      setAddBusy(false);
    }
  }, [addFields, retry]);

  const handleInviteSubmit = useCallback(async () => {
    setInviteBusy(true);
    setInviteError(null);
    setCopyHint(null);
    setCopied(false);
    try {
      const invite = await adminInvitesApi.create();
      if (!invite?.token) {
        setInviteError('The server did not return an invite token. Try again.');
        return;
      }
      // Shown exactly once — the backend never returns the token again.
      setJustCreated({
        link: buildInviteLink(invite.token),
        expiresAt: invite.expiresAt ?? null,
      });
      setComposer(null);
      retryInvites();
    } catch (err) {
      setInviteError(actionErrorMessage(err, 'Could not create the invite. Try again.'));
    } finally {
      setInviteBusy(false);
    }
  }, [retryInvites]);

  const handleCopyInviteLink = useCallback(async () => {
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
  }, [justCreated]);

  const openRevoke = useCallback((invite) => {
    setRevokeError(null);
    setRevokeTarget(invite);
  }, []);

  const handleRevoke = useCallback(async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      await adminInvitesApi.revoke(revokeTarget.id);
      setRevokeTarget(null);
      retryInvites();
    } catch (err) {
      setRevokeError(actionErrorMessage(err, 'Could not revoke the invite.'));
    } finally {
      setRevoking(false);
    }
  }, [revokeTarget, retryInvites]);

  const inviteColumns = useMemo(() => [
    ...inviteBaseColumns,
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => {
        const invite = row.original;
        if (inviteStatus(invite) === 'used') return <span className="admin-muted">—</span>;
        return (
          <Button
            type="button"
            variant="outlined"
            size="small"
            color="error"
            onClick={() => openRevoke(invite)}
            aria-label={`Revoke invite ${invite.id}`}
          >
            Revoke
          </Button>
        );
      },
    },
  ], [openRevoke]);

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
        <Button type="button" variant="contained" onClick={() => openComposer('add')}>
          + Add / Invite
        </Button>
      </div>

      {justCreated ? (
        <Alert severity="success" role="status" sx={{ mb: 2 }}>
          <h3>Invite created — copy the link now</h3>
          <p>
            The full link is shown only once. Share it with the officer; they can
            use it to create one admin account until it expires or is redeemed.
          </p>
          <div className="admin-invite-link-row">
            <TextField
              inputRef={linkInputRef}
              type="text"
              fullWidth
              margin="dense"
              variant="outlined"
              value={justCreated.link}
              aria-label="Invite link (shown once)"
              onFocus={(e) => e.currentTarget.select()}
              slotProps={{ input: { readOnly: true } }}
            />
            <Button type="button" variant="contained" onClick={handleCopyInviteLink}>
              {copied ? 'Copied ✓' : 'Copy link'}
            </Button>
          </div>
          {copyHint ? <p>{copyHint}</p> : null}
          <p>
            Expires {formatWhen(justCreated.expiresAt)} ·{' '}
            <Button
              type="button"
              variant="text"
              size="small"
              onClick={() => {
                setJustCreated(null);
                setCopyHint(null);
                setCopied(false);
              }}
            >
              Done
            </Button>
          </p>
        </Alert>
      ) : null}

      {pageActionError ? (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          {pageActionError}
        </Alert>
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

      <section aria-label="Pending invites" style={{ marginTop: 32 }}>
        <div className="admin-page-head">
          <div>
            <h2>Invites</h2>
            <p className="admin-muted">
              Single-use links (72-hour expiry) that let someone create their own admin account.
            </p>
          </div>
          <Button type="button" variant="contained" onClick={() => openComposer('invite')}>
            + New invite
          </Button>
        </div>
        <DataTable
          columns={inviteColumns}
          data={invites}
          loading={invitesLoading}
          loadingLabel="Loading invites…"
          error={invitesError}
          requestId={invitesRequestId}
          onRetry={retryInvites}
          searchColumnId="id"
          searchPlaceholder="Search invites…"
          pageSizeOptions={[20, 10]}
          renderEmptyState={
            <EmptyState
              title={(invitesData ?? []).length === 0 ? 'No invites yet' : 'No invites match this filter'}
              hint="Create a single-use link so a new officer can set up their own admin account."
            />
          }
        />
      </section>

      {composer ? (
        <InviteComposer
          mode={composer.mode}
          onModeChange={(mode) => openComposer(mode)}
          addFields={addFields}
          onAddField={setAddField}
          onAddSubmit={handleAddSubmit}
          addBusy={addBusy}
          addError={addError}
          onInviteSubmit={handleInviteSubmit}
          inviteBusy={inviteBusy}
          inviteError={inviteError}
          onClose={closeComposer}
        />
      ) : null}

      <InviteRevokeConfirm
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
