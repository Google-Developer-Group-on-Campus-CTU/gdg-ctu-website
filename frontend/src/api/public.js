import { apiFetch } from './client.js';
import { toArray, getId, getStatus, getUpdatedAt, qs } from './resources.js';
import { useFeed } from './feed.js';

/**
 * Public (unauthenticated) CMS contract — CMS simplification Phase 3.
 * Base is VITE_API_URL which already includes /GDGoC-CTU-Main/v0.0.1.
 * All payloads are safe fields only (no account IDs, no emails rendered).
 *
 * Retired: site-content helpers (GET /public/content is gone — hero/CTA
 * copy is hardcoded in the pages) and the `featured` event scope (the
 * backend rejects it with 400; use upcoming|past|recent).
 */

/** Scopes accepted by GET /public/events — anything else is rejected upstream with 400. */
const PUBLIC_EVENT_SCOPES = new Set(['upcoming', 'past', 'recent']);

/**
 * Unwrap a single-object payload. Handles generic envelopes
 * ({ data/item/result }), domain envelopes ({ teamMember/event }),
 * and the album detail shape ({ success, album, items }) by merging
 * items onto the album so mapAlbum sees both.
 */
function toObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload ?? null;
  if (payload.album && typeof payload.album === 'object' && !Array.isArray(payload.album)) {
    const items = Array.isArray(payload.items) ? payload.items : (payload.album.items ?? []);
    return { ...payload.album, items };
  }
  for (const key of ['data', 'item', 'result', 'teamMember', 'event']) {
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

/**
 * A list endpoint returning 404 means "this module has nothing yet" — render
 * an empty state instead of a red error. Anything else still propagates to
 * the feeds' ErrorState + Retry.
 */
async function getMany(path) {
  try {
    return toArray(await apiFetch(path));
  } catch (err) {
    if (err?.status === 404) return [];
    throw err;
  }
}

/**
 * Terms picklist (GET /public/terms → { success, terms }) and gallery
 * categories (GET /public/gallery/categories → { success, categories }).
 * These unwrap their domain envelope keys directly instead of going
 * through the generic toArray — resources.js LIST_KEYS is owned by the
 * admin lane and knows neither `terms` nor `categories`.
 */
async function getTermsList() {
  try {
    const payload = await apiFetch('/public/terms');
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && Array.isArray(payload.terms)) {
      return payload.terms;
    }
    return toArray(payload);
  } catch (err) {
    if (err?.status === 404) return [];
    throw err;
  }
}

async function getGalleryCategoriesList() {
  try {
    const payload = await apiFetch('/public/gallery/categories');
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && Array.isArray(payload.categories)) {
      return payload.categories;
    }
    return toArray(payload);
  } catch (err) {
    if (err?.status === 404) return [];
    throw err;
  }
}

export const publicApi = {
  getTeam: (params) => getMany(`/public/team${qs(params)}`),
  getTeamBySlug: (slug) => getOne(`/public/team/slug/${encodeURIComponent(slug)}`),
  getTerms: () => getTermsList(),
  getEvents: (scope = 'upcoming') => {
    const safeScope = PUBLIC_EVENT_SCOPES.has(scope) ? scope : 'upcoming';
    return getMany(`/public/events${qs({ scope: safeScope })}`);
  },
  getEventBySlug: (slug) => getOne(`/public/events/slug/${encodeURIComponent(slug)}`),
  getPartners: () => getMany('/public/partners'),
  getAlbums: (params) => {
    // Accepts a category slug string or a params object — either way the
    // filter runs server-side (?category=).
    const query = typeof params === 'string' ? (params ? { category: params } : {}) : (params ?? {});
    return getMany(`/public/gallery/albums${qs(query)}`);
  },
  getAlbumBySlug: (slug) => getOne(`/public/gallery/albums/slug/${encodeURIComponent(slug)}`),
  getGalleryCategories: () => getGalleryCategoriesList(),
  getFeaturedPhotos: () => getMany('/public/gallery/featured'),
  getHealth: () => apiFetch('/health'),
  /**
   * Public contact form (POST /public/contact-messages → 201).
   * Write-only: errors propagate to the caller (no 404 tolerance —
   * a missing route is a real failure the form must surface).
   */
  submitContact: (body) =>
    apiFetch('/public/contact-messages', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
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
    id: getId(m),
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
    status: getStatus(m),
    updatedAt: getUpdatedAt(m),
  };
}

export function mapEvent(e = {}) {
  return {
    id: getId(e),
    slug: e.slug ?? null,
    title: e.title ?? '(Untitled event)',
    short: e.short_description ?? e.shortDescription ?? '',
    description: e.description ?? '',
    coverUrl: pickImage(e),
    coverAlt: e.coverAlt ?? e.cover_alt ?? e.alt_text ?? e.title ?? 'Event cover',
    location: e.location ?? null,
    locationEmbedUrl: e.locationEmbedUrl ?? e.location_embed_url ?? null,
    externalUrl: e.externalUrl ?? e.external_url ?? null,
    timezone: e.timezone ?? null,
    startAt: e.startAt ?? e.start_at ?? null,
    endAt: e.endAt ?? e.end_at ?? null,
    status: getStatus(e),
    order: e.display_order ?? e.displayOrder ?? e.order ?? 0,
    updatedAt: getUpdatedAt(e),
  };
}

export function mapPartner(p = {}) {
  return {
    id: getId(p),
    slug: p.slug ?? null,
    name: p.name ?? 'Unnamed partner',
    logoUrl: pickImage(p),
    logoAlt: p.logoAlt ?? p.logo_alt ?? p.alt_text ?? p.name ?? 'Partner logo',
    website: p.websiteUrl ?? p.website_url ?? null,
    tier: String(p.tier ?? 'community').toLowerCase(),
    description: p.description ?? '',
    order: p.display_order ?? p.displayOrder ?? p.order ?? 0,
    status: getStatus(p),
  };
}

export function mapAlbum(a = {}) {
  const rawItems = a.items ?? a.photos ?? a.album_items ?? a.media ?? [];
  const category = a.category && typeof a.category === 'object' && !Array.isArray(a.category)
    ? {
      id: a.category.id ?? null,
      slug: a.category.slug ?? null,
      name: a.category.name ?? null,
    }
    : null;
  return {
    id: getId(a),
    slug: a.slug ?? null,
    title: a.title ?? a.name ?? '(Untitled album)',
    coverUrl: pickImage(a),
    coverAlt: a.coverAlt ?? a.cover_alt ?? a.alt_text ?? a.title ?? a.name ?? 'Album cover',
    eventId: a.eventId ?? a.event_id ?? null,
    date: a.date ?? null,
    description: a.description ?? '',
    category,
    categorySlug: category?.slug ?? a.categorySlug ?? a.category_slug ?? null,
    categoryName: category?.name ?? a.categoryName ?? a.category_name ?? null,
    featured: !!(a.isFeatured ?? a.is_featured),
    photoCount: a.photo_count ?? a.photoCount ?? (Array.isArray(rawItems) ? rawItems.length : 0),
    items: Array.isArray(rawItems) ? rawItems.map(mapPhoto).sort((x, y) => x.order - y.order) : [],
    status: getStatus(a),
  };
}

export function mapPhoto(it = {}) {
  const media = it.media && typeof it.media === 'object' ? it.media : it;
  const url = pickImage(it) ?? pickImage(media);
  const order = it.order ?? it.display_order ?? it.displayOrder ?? 0;
  const category = it.category && typeof it.category === 'object' && !Array.isArray(it.category)
    ? {
      id: it.category.id ?? null,
      slug: it.category.slug ?? null,
      name: it.category.name ?? null,
    }
    : null;
  return {
    id:
      getId(it) ??
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
    category,
    categorySlug: category?.slug ?? it.categorySlug ?? it.category_slug ?? null,
    featured: !!(it.isFeatured ?? it.is_featured),
  };
}

export function mapTerm(t = {}) {
  const name = t.name ?? '';
  return {
    id: getId(t) ?? (name || null),
    name,
    label: name ? `S.Y. ${name}` : 'School year',
    isCurrent: !!(t.isCurrent ?? t.is_current),
  };
}

export function mapGalleryCategory(c = {}) {
  return {
    id: getId(c) ?? c.slug ?? null,
    slug: c.slug ?? null,
    name: c.name ?? 'Unnamed category',
    order: c.displayOrder ?? c.display_order ?? c.order ?? 0,
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
  const { data, loading, error, requestId, retry } = useFeed(loader, { depsKey, initialData: null });
  return { data, loading, error, requestId, retry };
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
