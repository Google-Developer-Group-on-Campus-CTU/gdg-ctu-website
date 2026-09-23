import { apiFetch } from './client.js';

/**
 * Single-use admin invite links — contract shared with the backend lane.
 *
 * Admin-side (cookie session rides along in apiFetch, no Authorization header):
 *   POST   /admin-invites       → { id, token, expiresAt }
 *   GET    /admin-invites       → { invites: [{ id, createdAt, expiresAt, usedAt, usedBy, createdBy }] }
 *   DELETE /admin-invites/:id   → 204
 *
 * Public (any visitor holding the token):
 *   GET  /public/admin-invites/:token   → { valid, expiresAt?, reason? }
 *   POST /public/admin-invites/redeem   → 201 { userId, email }
 *        body { token, name, email, password }
 */

/**
 * The shareable link an invitee opens. Shape is fixed by the contract:
 * `${origin}/admin/register?token=${token}`.
 */
export function buildInviteLink(token) {
  return `${window.location.origin}/admin/register?token=${token}`;
}

/** Status badge derived from usedAt / expiresAt. */
export function inviteStatus(invite = {}) {
  if (invite.usedAt) return 'used';
  const expires = invite.expiresAt ? new Date(invite.expiresAt) : null;
  if (expires && !Number.isNaN(expires.getTime()) && expires.getTime() < Date.now()) {
    return 'expired';
  }
  return 'active';
}

/** Medium date + short time for expiry stamps, em dash when missing. */
export function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * `usedBy` / `createdBy` shape isn't pinned by the contract — it may be an id
 * string or a small object. Render either without crashing.
 */
export function displayActor(value) {
  if (!value) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value.name ?? value.email ?? value.id ?? '—';
  }
  return String(value);
}

export const adminInvitesApi = {
  list: () => apiFetch('/admin-invites'),
  create: () =>
    apiFetch('/admin-invites', { method: 'POST', body: JSON.stringify({}) }),
  revoke: (id) =>
    apiFetch(`/admin-invites/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};

/** Token travels as a path segment — percent-encode it on the way out. */
export const checkInvite = (token) =>
  apiFetch(`/public/admin-invites/${encodeURIComponent(token)}`);

export const redeemInvite = ({ token, name, email, password }) =>
  apiFetch('/public/admin-invites/redeem', {
    method: 'POST',
    body: JSON.stringify({ token, name, email, password }),
  });
