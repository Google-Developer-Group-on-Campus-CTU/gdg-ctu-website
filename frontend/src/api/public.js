import { apiFetch } from './client.js';
import { toArray } from './resources.js';
import { qs, useFeed } from './feed.js';

export { qs };

/**
 * Public (unauthenticated) CMS contract — spec v0.4 §5.
 * Base is VITE_API_URL which already includes /GDGoC-CTU-Main/v0.0.1.
 * All payloads are safe fields only (no account IDs, no emails rendered).
 */

/** Scopes accepted by GET /public/events — anything else is rejected upstream with 400. */
const PUBLIC_EVENT_SCOPES = new Set(['upcoming', 'past', 'featured', 'recent']);

/**
 * Unwrap a single-object payload. Handles generic envelopes
 * ({ data/item/result }), domain envelopes ({ teamMember/event/content }),
 * and the album detail shape ({ success, album, items }) by merging
 * items onto the album so mapAlbum sees both.
 */
function toObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload ?? null;
  if (payload.album && typeof payload.album === 'object' && !Array.isArray(payload.album)) {
    const items = Array.isArray(payload.items) ? payload.items : (payload.album.items ?? []);
    return { ...payload.album, items };
  }
  for (const key of ['data', 'item', 'result', 'teamMember', 'event', 'content']) {
    const value = payload[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  }
  return payload;
}

async function getOne(path) {
  try {
    return toObject(await apiFetch(path));
  } catch (err) {
    if (err?.status === 404) return null;
    throw err;
  }
}

export const publicApi = {
  getTeam: (params) => apiFetch(`/public/team${qs(params)}`).then(toArray),
  getTeamBySlug: (slug) => getOne(`/public/team/slug/${encodeURIComponent(slug)}`),
  getEvents: (scope = 'upcoming') => {
    const safeScope = PUBLIC_EVENT_SCOPES.has(scope) ? scope : 'upcoming';
    return apiFetch(`/public/events${qs({ scope: safeScope })}`).then(toArray);
  },
  getEventBySlug: (slug) => getOne(`/public/events/slug/${encodeURIComponent(slug)}`),
  getContent: () => apiFetch('/public/content').then(toArray),
  getContentByKey: (key) => getOne(`/public/content/${encodeURIComponent(key)}`),
  getPartners: () => apiFetch('/public/partners').then(toArray),
  getAlbums: () => apiFetch('/public/gallery/albums').then(toArray),
  getAlbumBySlug: (slug) => getOne(`/public/gallery/albums/slug/${encodeURIComponent(slug)}`),
  getFeaturedPhotos: () => apiFetch('/public/gallery/featured').then(toArray),
  getHealth: () => apiFetch('/health'),
};

/* ---------- defensive field mapping (camelCase + snake_case) ---------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(\?.*)?$/i;

/**
 * Sanitize a value before it reaches an <img src>.
 * Allows http(s)/protocol-relative URLs, data:/blob: image URIs, and
 * path-like values; rejects bare tokens such as media UUIDs (mediaId/publicId)
 * so a UUID is never rendered as an image source.
 */
export function safeSrc(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || UUID_RE.test(v)) return null;
  if (v.startsWith('data:image/') || v.startsWith('blob:')) return v;
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('//')) return v;
  if (v.startsWith('/') || IMAGE_EXT_RE.test(v)) return v;
  return null;
}

/** First usable image URL across camelCase/snake_case variants (UUID-safe). */
export function pickImage(item) {
  if (!item || typeof item !== 'object') return null;
  const media = item.media && typeof item.media === 'object' ? item.media : null;
  const candidates = [
    item.secure_url,
    item.secureUrl,
    item.url,
    item.imageUrl,
    item.image_url,
    item.coverUrl,
    item.cover_url,
    item.logoUrl,
    item.logo_url,
    item.photoUrl,
    item.photo_url,
    item.profileUrl,
    item.profile_url,
    item.image,
    item.cover,
    item.logo,
    item.photo,
    media?.secure_url,
    media?.secureUrl,
    media?.url,
  ];
  for (const candidate of candidates) {
    const src = safeSrc(candidate);
    if (src) return src;
  }
  return null;
}

export function mapMember(m = {}) {
  const first = m.firstName ?? m.first_name ?? '';
  const last = m.lastName ?? m.last_name ?? '';
  return {
    id: m.id ?? m._id ?? m.slug,
    slug: m.slug ?? null,
    name: m.name ?? (`${first} ${last}`.trim() || 'Unnamed member'),
    role: m.role ?? m.roleTitle ?? m.role_title ?? '',
    department: m.department ?? null,
    program: m.program ?? null,
    yearSection: m.yearSection ?? m.year_section ?? null,
    bio: m.bio ?? null,
    photoUrl: pickImage(m),
    photoAlt: m.profileAlt ?? m.profile_alt ?? m.alt_text ?? m.altText ?? m.name ?? 'Team member photo',
    linkedin: m.linkedin_url ?? m.linkedinUrl ?? null,
    github: m.github_url ?? m.githubUrl ?? null,
    website: m.website_url ?? m.websiteUrl ?? null,
    featured: !!(m.isFeatured ?? m.is_featured),
    order: m.display_order ?? m.displayOrder ?? m.order ?? 0,
  };
}

export function mapEvent(e = {}) {
  return {
    id: e.id ?? e._id ?? e.slug,
    slug: e.slug ?? null,
    title: e.title ?? '(Untitled event)',
    short: e.short_description ?? e.shortDescription ?? '',
    description: e.description ?? '',
    coverUrl: pickImage(e),
    coverAlt: e.coverAlt ?? e.cover_alt ?? e.alt_text ?? e.title ?? 'Event cover',
    location: e.location ?? null,
    registrationEnabled: !!(e.registrationEnabled ?? e.registration_enabled),
    registrationUrl: e.registrationUrl ?? e.registration_url ?? null,
    startAt: e.startAt ?? e.start_at ?? null,
    endAt: e.endAt ?? e.end_at ?? null,
    status: e.status ?? null,
    featured: !!(e.isFeatured ?? e.is_featured),
    order: e.display_order ?? e.displayOrder ?? e.order ?? 0,
  };
}

export function mapPartner(p = {}) {
  return {
    id: p.id ?? p._id ?? p.slug,
    slug: p.slug ?? null,
    name: p.name ?? 'Unnamed partner',
    logoUrl: pickImage(p),
    logoAlt: p.logoAlt ?? p.logo_alt ?? p.alt_text ?? p.name ?? 'Partner logo',
    website: p.websiteUrl ?? p.website_url ?? null,
    tier: String(p.tier ?? 'community').toLowerCase(),
    description: p.description ?? '',
    order: p.display_order ?? p.displayOrder ?? p.order ?? 0,
  };
}

export function mapAlbum(a = {}) {
  const rawItems = a.items ?? a.photos ?? a.album_items ?? a.media ?? [];
  return {
    id: a.id ?? a._id ?? a.slug,
    slug: a.slug ?? null,
    title: a.title ?? a.name ?? '(Untitled album)',
    coverUrl: pickImage(a),
    coverAlt: a.coverAlt ?? a.cover_alt ?? a.alt_text ?? a.title ?? a.name ?? 'Album cover',
    eventId: a.eventId ?? a.event_id ?? null,
    date: a.date ?? null,
    description: a.description ?? '',
    featured: !!(a.isFeatured ?? a.is_featured),
    photoCount: a.photo_count ?? a.photoCount ?? (Array.isArray(rawItems) ? rawItems.length : 0),
    items: Array.isArray(rawItems) ? rawItems.map(mapPhoto).sort((x, y) => x.order - y.order) : [],
  };
}

export function mapPhoto(it = {}) {
  const media = it.media && typeof it.media === 'object' ? it.media : it;
  const url = pickImage(it) ?? pickImage(media);
  const order = it.order ?? it.display_order ?? it.displayOrder ?? 0;
  return {
    id:
      it.id ??
      it._id ??
      it.uuid ??
      it.media_id ??
      it.mediaId ??
      media.id ??
      media.public_id ??
      media.publicId ??
      (url ? `${url}#${order}` : `photo-${order}`),
    url,
    alt:
      it.alt ??
      it.alt_text ??
      it.altText ??
      media.alt ??
      media.alt_text ??
      media.altText ??
      it.caption ??
      'Gallery photo',
    caption: it.caption ?? '',
    order,
    featured: !!(it.isFeatured ?? it.is_featured),
  };
}

export function mapContent(c = {}) {
  return {
    key: c.section_key ?? c.sectionKey ?? c.key ?? '',
    title: c.title ?? '',
    subtitle: c.subtitle ?? '',
    body: c.body ?? '',
    // Never fall back to a raw mediaId (UUID) — pickImage filters non-URL tokens.
    mediaUrl: pickImage(c),
    buttonText: c.buttonText ?? c.button_text ?? '',
    buttonUrl: c.buttonUrl ?? c.button_url ?? '',
    active: !!(c.is_active ?? c.isActive ?? true),
  };
}

export const TIER_ORDER = { platinum: 0, gold: 1, silver: 2, community: 3 };

export function sortPartners(list) {
  return [...list]
    .map(mapPartner)
    .sort((a, b) => (TIER_ORDER[a.tier] ?? 9) - (TIER_ORDER[b.tier] ?? 9) || a.order - b.order);
}

/** Shared public-feed state machine — delegates to the generic useFeed (see api/feed.js). */
export function usePublicFeed(loader, depsKey = '') {
  const { data, loading, error, retry } = useFeed(loader, { depsKey, initialData: null });
  return { data, loading, error, retry };
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
