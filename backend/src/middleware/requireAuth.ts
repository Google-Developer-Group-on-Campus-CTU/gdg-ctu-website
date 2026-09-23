import { getAuth, type ExpressRequestWithAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";
import { getAdminById } from "../modules/admins/models/admin.queries";
import logger from "../utils/logger";

const DEV_ADMIN_USER_ID = "dev-instant-admin";
const DEV_ADMIN_BYPASS_HEADER = "x-dev-admin-bypass";
const DEV_ADMIN_BYPASS_HEADER_VALUE = "dev-instant-admin";

// `@clerk/express` v2 brands `req.auth` with this global symbol and `getAuth()`
// throws unless `req.auth` is a function carrying it. Clerk's token-type check
// also downgrades any auth object without `tokenType: "session_token"` to
// `{ userId: null }`. The injected fake admin must satisfy both, otherwise
// downstream `getAuth(req)` calls (controllers, `getClerkIdFromRequest`)
// would throw or see a signed-out user — defeating the bypass.
const CLERK_AUTH_BRAND = Symbol.for("@clerk/express.auth");
const SESSION_TOKEN_TYPE = "session_token";

/**
 * DEV-ONLY: replace `req.auth` with a fake signed-in admin so downstream
 * `getAuth(req)` calls resolve to `userId: "dev-instant-admin"` without a
 * real Clerk session.
 *
 * Note: the spec's literal `req.auth = { userId: ... }` (plain object) would
 * make `getAuth(req)` throw in every consumer, so we keep Clerk's required
 * shape — a branded function — and force `userId` / `tokenType` on its result.
 * The handler installed earlier by `clerkMiddleware()` is spread in first so
 * the rest of the auth-object shape is preserved.
 */
function injectDevAdminAuth(req: Request): void {
      const existing = (req as ExpressRequestWithAuth).auth;

      const devAuth = () => ({
            ...(typeof existing === "function" ? existing() : null),
            userId: DEV_ADMIN_USER_ID,
            tokenType: SESSION_TOKEN_TYPE,
      });

      Object.assign(devAuth, { [CLERK_AUTH_BRAND]: true });
      (req as ExpressRequestWithAuth).auth = devAuth as ExpressRequestWithAuth["auth"];
}

/**
 * Express middleware that blocks unauthenticated requests.
 *
 * Apply this once on a router (see `routes/index.ts` or `createProtectedRouter`)
 * instead of repeating auth checks on every route handler. It relies on
 * `clerkMiddleware()` being registered globally in `server.ts` so Clerk can
 * attach session data to each incoming request.
 *
 * DEV-ONLY bypass: when `NODE_ENV !== "production"`, `DEV_ADMIN_BYPASS=true`,
 * and the request sends header `x-dev-admin-bypass: dev-instant-admin`, the
 * middleware injects the fake admin `dev-instant-admin` and skips the Clerk /
 * admins-table check entirely. Fails closed otherwise (production or flag off
 * behaves exactly as before).
 *
 * @example
 * // Protect every route under a feature router
 * protectedRouter.use(requireAuth);
 * protectedRouter.use(subscribersRoutes);
 *
 * @example
 * // Protect a single route
 * router.get("/profile", requireAuth, getProfile);
 */
export async function requireAuth(
      req: Request,
      res: Response,
      next: NextFunction,
) {
      // CORS preflight never carries credentials — let the cors middleware
      // answer it. Without this, OPTIONS /team-members gets a 401 and the
      // browser reports "CORS request did not succeed, Status code: (null)".
      if (req.method === "OPTIONS") {
            res.sendStatus(204);
            return;
      }
      if (
            process.env.NODE_ENV !== "production" &&
            process.env.DEV_ADMIN_BYPASS === "true" &&
            req.headers[DEV_ADMIN_BYPASS_HEADER] === DEV_ADMIN_BYPASS_HEADER_VALUE
      ) {
            logger.warn("DEV_ADMIN_BYPASS: instant admin bypass used", {
                  method: req.method,
                  path: req.path,
                  userId: DEV_ADMIN_USER_ID,
            });
            injectDevAdminAuth(req);
            next();
            return;
      }

      const { userId } = getAuth(req);

      if (!userId) {
            res.status(401).json({ error: "Unauthorized" });
            return;
      }

      try {
            const admin = await getAdminById(userId);

            // Allow first-time users through so POST /auth/sync can create
            // their admin record. All other protected routes require sync
            // to have happened at least once.
            if (admin && admin.isActive === false) {
                  res.status(403).json({
                        error: "Account deactivated — contact tech/web officer",
                  });
                  return;
            }
      } catch {
            // If the admin lookup fails (e.g. DB blip), fail closed.
            res.status(503).json({ error: "Authentication service unavailable" });
            return;
      }

      next();
}
