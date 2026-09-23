import { AppError } from "../../utils/http.js";

/**
 * Fixed CMS section keys (spec §4.7) — single source of truth for the
 * site-content module. Validations, services and controllers all
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
