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
  return item?.id ?? item?._id ?? item?.uuid ?? null;
}

export function getUpdatedAt(item) {
  return item?.updated_at ?? item?.updatedAt ?? item?.modified_at ?? item?.created_at ?? item?.createdAt ?? null;
}

export function getStatus(item) {
  return (item?.status ?? (item?.is_active === false ? 'archived' : 'draft')).toLowerCase();
}

function resource(base) {
  return {
    list: (params) => apiFetch(`${base}${qs(params)}`).then(toArray),
    get: (id) => apiFetch(`${base}/${encodeURIComponent(id)}`),
    getBySlug: (slug) => apiFetch(`${base}/slug/${encodeURIComponent(slug)}`),
    create: (body) =>
      apiFetch(base, { method: 'POST', body: JSON.stringify(body) }),
    update: (id, body) =>
      apiFetch(`${base}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
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
const unwrapContent = (payload) => payload?.siteContent ?? payload;

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
   */
  updateBySection: async (key, body) => {
    const row = await apiFetch(`/site-content/section/${encodeURIComponent(key)}`).then(unwrapContent);
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
    }).then(unwrapContent);
  },
};
export const mediaApi = {
  ...resource('/media'),
  /** Multipart upload (apiFetch is JSON-only, so this uses raw fetch). */
  upload: async (file, altText) => {
    const form = new FormData();
    form.append('file', file);
    if (altText) form.append('alt_text', altText);
    // Empty headers object: multipart must not set Content-Type (the browser
    // needs to append the boundary itself).
    const headers = {};
    const response = await fetch(`${API_BASE_URL}/media`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: form,
    });
    if (!response.ok) {
      const error = new Error(`Upload failed: ${response.status} ${response.statusText}`);
      error.status = response.status;
      try {
        error.body = await response.json();
      } catch {
        error.body = await response.text().catch(() => null);
      }
      throw error;
    }
    return response.json();
  },
};

/** Public GETs for preview links (spec §5). Backend ships these after the V1 backend pass; they 404 until then. */
export const publicPreview = {
  events: (scope = 'upcoming') => `/events?scope=${encodeURIComponent(scope)}`,
  eventSlug: (slug) => `/events/${encodeURIComponent(slug)}`,
  team: () => '/officers',
  partners: () => '/#partners',
  albumSlug: (slug) => `/gallery#${encodeURIComponent(slug)}`,
};

export { API_BASE_URL };
