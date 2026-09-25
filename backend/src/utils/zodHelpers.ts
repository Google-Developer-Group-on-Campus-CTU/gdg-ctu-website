import { z } from "zod";

/**
 * Map empty / whitespace-only strings to `null` before validation.
 *
 * Form/Multipart clients send `""` for cleared optional fields while the
 * flat-JSON contract sends `null` or omits the key. Plain
 * `z.uuid().nullable().optional()` (and `z.url()`) rejects `""`, surfacing
 * as `invalid id` 400s on create. Wrapping those fields keeps both
 * contracts working without touching route paths or auth.
 */
export const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
      z.preprocess(
            (v) => (typeof v === "string" && v.trim() === "" ? null : v),
            schema,
      );

/** Optional UUID FK (media refs, album refs, …): `""` → `null` → passes. */
export const nullableUuid = (message?: string) =>
      message
            ? emptyToNull(z.uuid({ message }).nullable().optional())
            : emptyToNull(z.uuid().nullable().optional());

/** Optional URL field: `""` → `null` → passes. */
export const nullableUrl = () => emptyToNull(z.url().nullable().optional());
