import { AppError } from "./http";

/**
 * Extracts and parses a JSON payload from a multipart form-data request body.
 *
 * In multipart requests, nested objects are often sent as stringified JSON under a specific field.
 * If that field exists, this function parses it. If not, it falls back to using the entire
 * request body, allowing you to exclude specific helper fields that shouldn't reach your DTO.
 *
 * @param {Record<string, any>} body - The request body object (typically `req.body`).
 * @param {string} jsonFieldName - The key where the stringified JSON might live (e.g., 'member', 'event').
 * @param {string[]} [excludedFields=[]] - An array of keys to delete if falling back to the flat body.
 * @returns {any} The parsed payload ready for Zod validation or DTO mapping.
 * @throws {AppError} Throws a 400 error if the payload is malformed or completely empty.
 *
 * @example
 * // In your controller:
 * const payload = extractMultipartPayload(req.body, "member", ["uploadedBy"]);
 */
export const extractMultipartPayload = (
      body: Record<string, any>,
      jsonFieldName: string,
      excludedFields: string[] = [],
): any => {
      let payload: any;

      // 1. Check if the stringified JSON field exists
      if (body[jsonFieldName]) {
            try {
                  payload = JSON.parse(body[jsonFieldName]);
            } catch (error) {
                  throw new AppError(
                        400,
                        `'${jsonFieldName}' JSON payload is malformed`,
                  );
            }
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
