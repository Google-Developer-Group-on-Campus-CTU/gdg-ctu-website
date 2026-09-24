import { apiFetch, API_BASE_URL } from './client.js';
import { qs } from './feed.js';

export { qs };

/**
 * Envelope keys a backend list payload may nest its array under.
 * Generic keys first, then domain keys used by public routes
 * (team/events/albums/partners/content/photos) and admin routes
 * (teamMembers/siteContent/media/eventSpeakers).
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
  'content',
  'photos',
  'teamMembers',
  'siteContent',
  'media',
  'eventSpeakers',
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
  for (const key of ['data', 'item', 'result', 'teamMember', 'event', 'partner', 'content', 'media', 'album', 'siteContent']) {
    const value = payload[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  }
  return payload;
}

function resource(base) {
  return {
    list: (params) => apiFetch(`${base}${qs(params)}`).then(toArray),
    get: (id) => apiFetch(`${base}/${encodeURIComponent(id)}`).then(unwrapOne),
    getBySlug: (slug) => apiFetch(`${base}/slug/${encodeURIComponent(slug)}`).then(unwrapOne),
    create: (body) =>
      apiFetch(base, { method: 'POST', body: JSON.stringify(body) }).then(unwrapOne),
    update: (id, body) =>
      apiFetch(`${base}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }).then(unwrapOne),
    remove: (id) =>
      apiFetch(`${base}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
}

export const eventsApi = resource('/events');
export const teamApi = resource('/team-members');
export const speakersApi = resource('/event-speakers');
/** Greenfield per spec §4.5 — follows the team-members pattern. Backend module may still be pending (expect 404 until shipped). */
export const partnersApi = resource('/partners');
/** Gallery albums extend media-collections; items live in media-collection-items (spec §4.6, "extend, don't fork"). */
export const albumsApi = resource('/media-collections');
export const albumItemsApi = resource('/media-collection-items');
/**
 * Admin site-content API. The backend wraps every single-row response in
 * `{ success, siteContent }`, so each method unwraps to the row itself —
 * callers (ContentEditor) get the id/fields directly instead of the envelope.
 */
const unwrapContent = (payload) => payload?.siteContent ?? unwrapOne(payload);

export const contentApi = {
  ...resource('/site-content'),
  get: (id) =>
    apiFetch(`/site-content/${encodeURIComponent(id)}`).then(unwrapContent),
  create: (body) =>
    apiFetch('/site-content', { method: 'POST', body: JSON.stringify(body) }).then(unwrapContent),
  update: (id, body) =>
    apiFetch(`/site-content/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }).then(unwrapContent),
  getBySection: (key) =>
    apiFetch(`/site-content/section/${encodeURIComponent(key)}`).then(unwrapContent),
  /**
   * sectionKey fallback when the editor has no row id yet: resolve the key
   * through the read-only GET /section/:sectionKey, then PATCH by UUID
   * (PATCH /:id is the only writable path — :id is validateUuid-checked).
   * One AbortSignal is shared by both legs: aborting cancels the resolving
   * GET, and a signal aborted mid-lookup makes the PATCH fail immediately
   * instead of firing after the caller went away.
   */
  updateBySection: async (key, body, { signal } = {}) => {
    const row = await apiFetch(`/site-content/section/${encodeURIComponent(key)}`, { signal }).then(unwrapContent);
    const id = getId(row);
    if (!id) {
      const err = new Error(`No site content row for section "${key}"`);
      err.status = 404;
      err.body = { message: `No site content row for section "${key}"` };
      throw err;
    }
    return apiFetch(`/site-content/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      signal,
    }).then(unwrapContent);
  },
};
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
