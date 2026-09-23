import { useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { useFeed } from '../api/feed.js';

/* ===========================================================================
 * GENERATED — backend contract vocabulary, hand-synced. DO NOT EDIT VALUES.
 * The frontend cannot import backend TS at runtime, so these arrays are
 * copied VERBATIM from the backend source of truth (order included). Re-sync
 * whenever a source file changes.
 *
 *   EVENT_STATUSES ← backend/src/modules/events/models/event.ts         (EVENT_STATUSES)
 *   PARTNER_TIERS  ← backend/src/modules/partners/models/partner.ts    (PARTNER_TIERS)
 *   CONTENT_KEYS   ← backend/src/modules/site-content/section-keys.ts  (SECTION_KEYS — renamed CONTENT_KEYS here)
 *
 * Source snapshot date: 2026-09-24
 * ========================================================================= */
export const EVENT_STATUSES = ['draft', 'published', 'archived', 'cancelled'];
export const PARTNER_TIERS = ['platinum', 'gold', 'silver', 'community'];
export const CONTENT_KEYS = ['hero', 'about', 'community', 'cta', 'footer'];

/* ---------------------------------------------------------------------------
 * Frontend-only constants — no backend contract behind these: reserved route
 * slugs, UX feature caps, and the media-picker limits.
 * ------------------------------------------------------------------------- */
export const RESERVED_SLUGS = ['api', 'admin', 'media', 'sitemap.xml', 'login', 'events', 'team', 'gallery', 'content', 'partners', 'settings', 'officers'];
export const MAX_FEATURED_EVENTS = 3;
export const MAX_FEATURED_TEAM = 10;
export const MAX_FEATURED_PHOTOS = 8;
export const MEDIA_ALLOW = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;

export function slugify(value = '') {
  return value
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function isReservedSlug(slug) {
  return RESERVED_SLUGS.includes(String(slug).toLowerCase());
}

export function isHttpsUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isAnyUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Inline async uniqueness check: 404 => unique; 200 with a different id => duplicate. */
export async function checkSlugUnique(api, slug, currentId = null) {
  if (!slug || isReservedSlug(slug)) return false;
  try {
    const found = await api.getBySlug(slug);
    const foundId = found?.id ?? found?._id;
    if (currentId && foundId && String(foundId) === String(currentId)) return true;
    return false;
  } catch (err) {
    if (err?.status === 404) return true;
    throw err;
  }
}

function required(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

/* ---------------------------------------------------------------------------
 * validate* policy (architecture candidate 2): UX-level checks ONLY —
 * (1) required-field presence for fields the backend also requires,
 * (2) URL shape, (3) reserved slugs.
 * The backend Zod schemas are the single source of truth for nullability,
 * enums, ranges and cross-field rules; anything not checked here surfaces as
 * a serverError banner from the backend 400 on save. Do not re-add rules that
 * are stricter than the backend — they rejected payloads the API accepts.
 * ------------------------------------------------------------------------- */

export function validateEvent(v) {
  const errors = {};
  if (!required(v.title)) errors.title = 'Title is required.';
  if (!required(v.slug)) errors.slug = 'Slug is required.';
  else if (isReservedSlug(v.slug)) errors.slug = 'This slug is reserved.';
  if (!required(v.startAt)) errors.startAt = 'Start date/time is required.';
  if (!required(v.endAt)) errors.endAt = 'End date/time is required.';
  if (v.registrationEnabled && !isHttpsUrl(v.registrationUrl)) {
    errors.registrationUrl = 'Registration URL must be a valid https:// URL when registration is enabled.';
  }
  return errors;
}

export function validateTeam(v) {
  const errors = {};
  if (!required(v.firstName)) errors.firstName = 'First name is required.';
  if (!required(v.lastName)) errors.lastName = 'Last name is required.';
  if (!required(v.slug)) errors.slug = 'Slug is required.';
  else if (isReservedSlug(v.slug)) errors.slug = 'This slug is reserved.';
  for (const key of ['linkedin_url', 'github_url', 'website_url']) {
    if (v[key] && !isAnyUrl(v[key])) errors[key] = 'Must be a valid URL.';
  }
  return errors;
}

export function validatePartner(v) {
  const errors = {};
  if (!required(v.name)) errors.name = 'Name is required.';
  if (!required(v.slug)) errors.slug = 'Slug is required.';
  else if (isReservedSlug(v.slug)) errors.slug = 'This slug is reserved.';
  if (v.websiteUrl && !isHttpsUrl(v.websiteUrl)) errors.websiteUrl = 'Website must be a valid https:// URL.';
  return errors;
}

export function validateAlbum(v) {
  const errors = {};
  // Primary-field presence intentionally not checked here: the form field is
  // `title` but the backend contract requires `name` (FE↔BE payload mapping
  // lives in AlbumDetail — out of this slice's scope); the backend 400 on a
  // missing `name` is surfaced via serverError.
  if (!required(v.slug)) errors.slug = 'Slug is required.';
  else if (isReservedSlug(v.slug)) errors.slug = 'This slug is reserved.';
  return errors;
}

export function validateContent(v) {
  const errors = {};
  if (v.buttonUrl && !isAnyUrl(v.buttonUrl)) errors.buttonUrl = 'Button URL must be valid.';
  return errors;
}

/** Warn on dirty-form navigation (react-router blocker + native beforeunload). */
export function useDirtyGuard(dirty) {
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  return blocker;
}

/** Shared list-fetch state machine — delegates to the generic useFeed (see api/feed.js). */
export function useAdminList(loader, depsKey = '') {
  return useFeed(loader, { depsKey, initialData: [], withRequestId: true });
}

export function timeAgo(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function useDebouncedValue(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef(null);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer.current);
  }, [value, delay]);
  return debounced;
}

/**
 * Canonical admin entity→route map (spec v0.4 §3). Single source of truth for
 * the App.jsx admin route table, the shell NAV, Dashboard item links and the
 * +New target — do not hardcode admin entity paths elsewhere.
 *
 * - `label`: NAV display label.
 * - `list` / `new`: exact route paths.
 * - `detail(id)`: builds a detail path; `param` names the :param placeholder
 *   (App.jsx derives the route pattern via `detail(':' + param)`).
 */
export const ADMIN_ENTITY_ROUTES = {
  events: { label: 'Events', list: '/admin/events', new: '/admin/events/new', detail: (id) => `/admin/events/${id}`, param: 'id' },
  team: { label: 'Team', list: '/admin/team', new: '/admin/team/new', detail: (id) => `/admin/team/${id}`, param: 'id' },
  partners: { label: 'Partners', list: '/admin/partners', new: '/admin/partners/new', detail: (id) => `/admin/partners/${id}`, param: 'id' },
  gallery: { label: 'Gallery', list: '/admin/gallery', new: '/admin/gallery/albums/new', detail: (id) => `/admin/gallery/albums/${id}`, param: 'id' },
  content: { label: 'Content', list: '/admin/content', new: '/admin/content', detail: (key) => `/admin/content/${key}`, param: 'sectionKey' },
  media: { label: 'Media', list: '/admin/media', new: '/admin/media', detail: null, param: null },
};

export function adminItemLabel(item, fallback = 'Untitled') {
  return item?.title ?? item?.name ?? item?.section_key ?? item?.sectionKey ?? item?.filename ?? fallback;
}

export function adminDetailPathFor(kind, item) {
  const entry = ADMIN_ENTITY_ROUTES[kind];
  if (!entry?.detail) return '/admin';
  if (kind === 'content') return entry.detail(item?.section_key ?? item?.sectionKey);
  return entry.detail(item?.id ?? item?._id ?? item?.uuid ?? item?.slug);
}

/** Longest-prefix match of the current admin path to its section's "new" target. */
export function adminNewTargetFor(pathname = '') {
  const entries = Object.values(ADMIN_ENTITY_ROUTES).sort((a, b) => b.list.length - a.list.length);
  const match = entries.find((e) => pathname === e.list || pathname.startsWith(`${e.list}/`));
  return match?.new ?? ADMIN_ENTITY_ROUTES.events.new;
}
