import { AppError } from "../../utils/http.js";

/**
 * Fixed CMS section keys (spec §4.7) — single source of truth for the
 * site-content module. Validations, services, controllers and cache keys all
 * import from here; do not copy this list anywhere else in the backend.
 */
export const SECTION_KEYS = [
      "hero",
      "about",
      "community",
      "cta",
      "footer",
] as const;

/** One of the fixed section keys. */
export type SectionKey = (typeof SECTION_KEYS)[number];

/** Runtime guard: unknown value → one of the fixed section keys. */
export const isSectionKey = (value: unknown): value is SectionKey =>
      typeof value === "string" &&
      (SECTION_KEYS as readonly string[]).includes(value);

/**
 * sectionKey is immutable (spec §4.7) — fixed keys, no renames. Throws the
 * module's 400 when a payload tries to change an existing row's key.
 */
export const assertSectionKeyImmutable = (
      current: SectionKey | string,
      next: string | null | undefined,
) => {
      if (next && next !== current) {
            throw new AppError(
                  400,
                  "sectionKey is immutable and cannot be changed",
            );
      }
};

/**
 * Redis cache contract (team-members cache rule): namespace `site-content:`,
 * TTL 60 seconds (setCache's ttl is seconds, not ms). Admin list / byId /
 * by-key reads and the public active-only list
 * all live under this prefix, so `clearCacheByPrefix("site-content:")` on
 * create/update/delete invalidates every entry in one call.
 */
export const SITE_CONTENT_CACHE_PREFIX = "site-content:";
export const SITE_CONTENT_CACHE_TTL = 60;

export const siteContentCacheKeys = {
      prefix: SITE_CONTENT_CACHE_PREFIX,
      /** Admin row by UUID → `site-content:{id}` */
      byId: (id: string) => `${SITE_CONTENT_CACHE_PREFIX}${id}`,
      /** Admin paginated list → `site-content:{page}:{limit}` */
      list: (page: number, limit: number) =>
            `${SITE_CONTENT_CACHE_PREFIX}${page}:${limit}`,
      /** Admin by sectionKey → `site-content:key:{key}` */
      byKey: (key: string) => `${SITE_CONTENT_CACHE_PREFIX}key:${key}`,
      /** Public active-only list → `site-content:public:list` */
      publicList: `${SITE_CONTENT_CACHE_PREFIX}public:list`,
} as const;
