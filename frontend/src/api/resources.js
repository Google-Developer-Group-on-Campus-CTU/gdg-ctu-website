import { apiFetch, API_BASE_URL } from './client.js';
import { qs } from './feed.js';

export { qs };

/**
 * Envelope keys a backend list payload may nest its array under.
 * Generic keys first, then domain keys used by public routes
 * (team/events/albums/partners) and admin routes
 * (teamMembers/media/terms/memberTerms/categories).
 */
const LIST_KEYS = [
  'data',
  'items',
  'rows',
  'results',
  'team',
  'events',
  'albums',
  'partners',
  'photos',
  'teamMembers',
  'media',
  'terms',
  'memberTerms',
  'categories',
  'collections',
];

/** Normalize list payloads: backend may return an array or a keyed envelope. */
export function toArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of LIST_KEYS) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  return [];
}

export function getId(item) {
  return item?.id ?? item?._id ?? item?.uuid ?? item?.slug ?? null;
}

export function getUpdatedAt(item) {
  return item?.updated_at ?? item?.updatedAt ?? item?.modified_at ?? item?.created_at ?? item?.createdAt ?? null;
}

export function getStatus(item) {
  const raw = item?.status;
  if (typeof raw === 'string' && raw.trim()) return raw.trim().toLowerCase();
  if (item?.is_active === false) return 'archived';
  if (item?.is_active === true) return 'published';
  return 'draft';
}

function unwrapOne(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload ?? null;
  for (const key of ['data', 'item', 'result', 'teamMember', 'event', 'partner', 'media', 'album', 'collection', 'term', 'memberTerm', 'category']) {
    const value = payload[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  }
  return payload;
}

/**
 * Guard for UUID-routed reads/writes (GET/PATCH/DELETE /:id). The backend
 * rejects anything that is not a UUID with 400 "Invalid id", so a missing id
 * (undefined/null/'') or the literal string 'undefined' must throw here
 * instead of firing a request to .../undefined.
 */
function assertResourceId(id, method) {
  if (id === undefined || id === null || id === '' || id === 'undefined') {
    throw new Error(`Missing id — cannot call ${method} without a UUID (got ${String(id)}).`);
  }
}

function assertResourceSlug(slug, method) {
  if (slug === undefined || slug === null || slug === '' || slug === 'undefined') {
    throw new Error(`Missing slug — cannot call ${method} without a slug (got ${String(slug)}).`);
  }
}

function resource(base) {
  return {
    list: (params) => apiFetch(`${base}${qs(params)}`).then(toArray),
    get: (id) => {
      assertResourceId(id, 'get');
      return apiFetch(`${base}/${encodeURIComponent(id)}`).then(unwrapOne);
    },
    detail: (id) => {
      assertResourceId(id, 'detail');
      return apiFetch(`${base}/${encodeURIComponent(id)}`).then(unwrapOne);
    },
    getBySlug: (slug) => {
      assertResourceSlug(slug, 'getBySlug');
      return apiFetch(`${base}/slug/${encodeURIComponent(slug)}`).then(unwrapOne);
    },
    create: (body) =>
      apiFetch(base, { method: 'POST', body: JSON.stringify(body) }).then(unwrapOne),
    update: (id, body) => {
      assertResourceId(id, 'update');
      return apiFetch(`${base}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }).then(unwrapOne);
    },
    remove: (id) => {
      assertResourceId(id, 'remove');
      return apiFetch(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };
}

export const eventsApi = resource('/events');
export const teamApi = resource('/team-members');
/** Greenfield per spec §4.5 — follows the team-members pattern. Backend module may still be pending (expect 404 until shipped). */
export const partnersApi = resource('/partners');
/** Gallery albums extend media-collections; items live in media-collection-items (spec §4.6, "extend, don't fork"). */
export const albumsApi = resource('/media-collections');
export const albumItemsApi = resource('/media-collection-items');
/** Gallery category taxonomy for the ?category= album filter (CMS simplification Phase 2). */
export const galleryCategoriesApi = resource('/gallery-categories');
/** Academic-term roster: terms own the date range, member-terms link team members per term. */
export const termsApi = resource('/terms');
export const memberTermsApi = resource('/member-terms');
export const mediaApi = {
  ...resource('/media'),
  /**
   * Multipart upload through apiFetch (inherits the 15s timeout and
   * `error.status`/`error.body` parsing). No Content-Type is set here — the
   * browser appends the multipart boundary itself for FormData bodies.
   */
  upload: (file, altText) => {
    const form = new FormData();
    form.append('file', file);
    if (altText) form.append('alt_text', altText);
    return apiFetch('/media', { method: 'POST', body: form }).then(unwrapOne);
  },
};

/** Public preview links for the published site — wired to frontend routes. */
export const publicPreview = {
  events: (scope = 'upcoming') => `/events?scope=${encodeURIComponent(scope)}`,
  eventSlug: (slug) => `/events/${encodeURIComponent(slug)}`,
  team: () => '/team',
  partners: () => '/partners',
  albumSlug: (slug) => `/gallery/${encodeURIComponent(slug)}`,
};

export { API_BASE_URL };
