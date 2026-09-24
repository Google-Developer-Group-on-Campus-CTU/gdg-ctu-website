import { AppError } from "./http.js";

/**
 * Extracts and parses a JSON payload from a multipart form-data request body.
 *
 * In multipart requests, nested objects are often sent as stringified JSON under a specific field.
 * If that field exists, this function parses it. If not, it falls back to using the entire
 * request body, allowing you to exclude specific helper fields that shouldn't reach your DTO.
 *
 * @param {Record<string, unknown>} body - The request body object (typically `req.body`).
 * @param {string} jsonFieldName - The key where the stringified JSON might live (e.g., 'member', 'event').
 * @param {string[]} [excludedFields=[]] - An array of keys to delete if falling back to the flat body.
 * @returns {Record<string, unknown>} The parsed payload ready for Zod validation or DTO mapping.
 * @throws {AppError} Throws a 400 error if the payload is malformed or completely empty.
 *
 * @example
 * // In your controller:
 * const payload = extractMultipartPayload(req.body, "member", ["uploadedBy"]);
 */
export const extractMultipartPayload = (
      body: Record<string, unknown>,
      jsonFieldName: string,
      excludedFields: string[] = [],
): Record<string, unknown> => {
      let payload: Record<string, unknown>;

      // 1. Check if the stringified JSON field exists
      const raw = body[jsonFieldName];
      if (raw !== undefined && raw !== null && raw !== "") {
            payload = parseJsonField(raw, jsonFieldName);
      } else {
            // 2. Fallback: No JSON wrapper, treat the remaining body fields as the payload
            payload = { ...body };

            // Clean up helper fields that are not part of the target schema/DTO
            for (const field of excludedFields) {
                  delete payload[field];
            }
      }

      // 3. Ensure we have at least one field to prevent Zod or DB errors on empty updates
      if (!payload || Object.keys(payload).length === 0) {
            throw new AppError(
                  400,
                  "At least one field is required for the payload",
            );
      }

      return payload;
};

/**
 * Safely parses a single stringified-JSON multipart field (e.g. `member`,
 * `event`, `partner`). Raw `JSON.parse` throws a bare SyntaxError that the
 * generic error path turns into a 500 — this maps it to a 400 naming the
 * offending field, and rejects non-object payloads (arrays, primitives)
 * that could never satisfy a Zod object schema.
 *
 * @param {unknown} value - The raw field value (typically `req.body[field]`).
 * @param {string} fieldName - The field key, used in the 400 message.
 * @returns {Record<string, unknown>} The parsed object payload.
 * @throws {AppError} 400 when the field is not a JSON-encoded object.
 */
export const parseJsonField = (
      value: unknown,
      fieldName: string,
): Record<string, unknown> => {
      if (typeof value !== "string" || value.trim() === "") {
            throw new AppError(
                  400,
                  `Invalid JSON in '${fieldName}' payload: expected a JSON-encoded object`,
            );
      }
      let parsed: unknown;
      try {
            parsed = JSON.parse(value);
      } catch {
            throw new AppError(
                  400,
                  `Invalid JSON in '${fieldName}' payload`,
            );
      }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new AppError(
                  400,
                  `Invalid JSON in '${fieldName}' payload: expected a JSON-encoded object`,
            );
      }
      return parsed as Record<string, unknown>;
};
