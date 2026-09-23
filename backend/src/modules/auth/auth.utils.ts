import type { Request } from "express";
import type { AuthedRequest } from "../../middleware/requireAuth.js";

/**
 * Returns the Better Auth user ID for the current request, or undefined when
 * no session is attached.
 *
 * `requireAuth` resolves the session once and caches it on `req.authSession`;
 * this helper is the single read path that replaced the old Clerk
 * `getClerkIdFromRequest`. The old `req.body.uploadedBy` fallback is gone —
 * callers must never trust a client-supplied actor ID.
 */
export const getUserIdFromRequest = (req: Request): string | undefined =>
      (req as Partial<AuthedRequest>).authSession?.user.id;
