import { Request, Response, NextFunction } from "express";

// UUID v1–v5 shape shared with `validateUuid` in utils/http (kept local on
// purpose — Phase 3 centralizes it; see Task 9).
const UUID_PATTERN =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Params that carry UUIDs by naming convention (`id`, `*Id`). Everything
 * else (slugs, tokens) is presence-checked only.
 */
const isUuidParam = (name: string) => name === "id" || /Id$/.test(name);

/**
 * A higher-order middleware factory that validates the presence of required
 * path parameters (`req.params`) in an incoming Express request.
 *
 * * Rejects the request with a `400 Bad Request` if any specified parameter is missing.
 * * Params named `id` / `*Id` must additionally match UUID shape
 *   (`400 Invalid <param>`), so per-controller `validateUuid` on those
 *   routes is redundant.
 * * @param requiredParams - Variadic list of parameter keys expected in the URL path (e.g., 'id', 'slug').
 * * @returns An Express middleware function.
 * * @example
 * // Validates that both :userId and :postId exist in the URL
 * router.get("/users/:userId/posts/:postId", validateParams("userId", "postId"), handler);
 */
export function validateParams(...requiredParams: string[]) {
      return (req: Request, res: Response, next: NextFunction) => {
            for (const param of requiredParams) {
                  const value = req.params[param];
                  if (!value) {
                        return res.status(400).json({
                              message: `${param} is required`,
                        });
                  }
                  if (
                        isUuidParam(param) &&
                        (Array.isArray(value) || !UUID_PATTERN.test(value))
                  ) {
                        return res.status(400).json({
                              message: `Invalid ${param}`,
                        });
                  }
            }

            next();
      };
}
