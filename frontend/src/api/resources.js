import { apiFetch, API_BASE_URL, getAuthToken } from './client.js';
import { qs } from './feed.js';

export { qs };

/** Normalize list payloads: backend may return an array or { data/items/rows }. */
export function toArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['data', 'items', 'rows', 'results']) {
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
export const contentApi = {
  ...resource('/site-content'),
  getBySection: (key) => apiFetch(`/site-content/section/${encodeURIComponent(key)}`),
};
export const mediaApi = {
  ...resource('/media'),
  /** Multipart upload (apiFetch is JSON-only, so this uses raw fetch). */
  upload: async (file, altText) => {
    const form = new FormData();
    form.append('file', file);
    if (altText) form.append('alt_text', altText);
    const headers = {};
    const token = await getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
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
