import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { adminRoles, adminUserIds, auth } from "../config/auth.js";
import logger from "../utils/logger.js";

/** Better Auth session shape returned by `auth.api.getSession` (or null). */
export type AuthSession = NonNullable<
      Awaited<ReturnType<typeof auth.api.getSession>>
>;

/**
 * Express request carrying the session resolved by `requireAuth`.
 * Downstream helpers (`getUserIdFromRequest`, `/auth/me`) read it from here
 * instead of re-querying Better Auth.
 */
export interface AuthedRequest extends Request {
      authSession: AuthSession;
}

/**
 * Express middleware that blocks unauthenticated / non-admin requests.
 *
 * Applied once on the protected router (see `modules/index.ts`) instead of
 * per-route. Resolves the Better Auth session from the request cookie via
 * `auth.api.getSession` — no Clerk, no `clerkMiddleware`, no admins table:
 *
 * - 401 — no session (previously: missing Clerk userId)
 * - 403 — signed in but banned or not an admin (admin plugin role/banned;
 *          replaces the old custom `admins.isActive === false` check)
 * - 503 — session lookup failed (fail closed; same semantics as before)
 *
 * The old DEV_ADMIN_BYPASS (Cork-symbol fake session) is gone — bootstrap a
 * real admin via the ADMIN_USER_IDS env (admin plugin `adminUserIds`).
 *
 * @example
 * protectedRouter.use(requireAuth);
 */
export async function requireAuth(
      req: Request,
      res: Response,
      next: NextFunction,
) {
      // CORS preflight never carries credentials — let the cors middleware
      // (registered first in server.ts) answer it. Keep this guard so a
      // stray OPTIONS never 401s.
      if (req.method === "OPTIONS") {
            res.sendStatus(204);
            return;
      }

      try {
            const session = await auth.api.getSession({
                  headers: fromNodeHeaders(req.headers),
            });

            if (!session) {
                  res.status(401).json({ error: "Unauthorized" });
                  return;
            }

            const { user } = session;

            // Banned (admin plugin) — the folded equivalent of isActive=false.
            if (user.banned) {
                  res.status(403).json({
                        error: "Account deactivated — contact tech/web officer",
                  });
                  return;
            }

            const isAdmin =
                  adminRoles.includes(user.role ?? "") ||
                  adminUserIds.includes(user.id);
            if (!isAdmin) {
                  res.status(403).json({
                        error: "Forbidden — admin access required",
                  });
                  return;
            }

            // Cache for downstream handlers (single session lookup per request).
            (req as AuthedRequest).authSession = session;
            next();
      } catch (error) {
            // Session lookup failed. Only known transient faults (DB / network
            // blips) keep the historical 503 fail-closed shape — coding bugs
            // fall through to the final JSON error handler as 500 so a bug
            // can never masquerade as an unavailable auth service.
            logger.error("requireAuth failed", {
                  message:
                        error instanceof Error ? error.message : String(error),
                  stack: error instanceof Error ? error.stack : undefined,
            });
            if (isTransientAuthError(error)) {
                  res.status(503).json({
                        error: "Authentication service unavailable",
                  });
                  return;
            }
            next(error);
      }
}

/**
 * Matches the transient faults a session-store lookup can actually raise:
 * pool/network failures and query timeouts. Anything else (TypeError,
 * bad config, programming error) is a 500, not a 503.
 */
function isTransientAuthError(error: unknown): boolean {
      const message =
            error instanceof Error ? error.message : String(error ?? "");
      const code =
            typeof error === "object" && error !== null
                  ? String(
                          (error as { code?: unknown }).code ?? "",
                        ).toUpperCase()
                  : "";
      if (
            code.startsWith("ETIMEDOUT") ||
            code.startsWith("ECONN") ||
            code === "ENOTFOUND" ||
            code === "EAI_AGAIN" ||
            code === "EPIPE" ||
            code === "57P01" || // admin_shutdown
            code === "57P03" || // cannot_connect_now
            code === "08000" || // connection_exception
            code === "08006" || // connection_failure
            code.startsWith("08")
      ) {
            return true;
      }
      return /timeout|timed out|fetch failed|network|socket hang up|connection|pool|unavailable|temporar|try again|econn|enotfound/i.test(
            message,
      );
}
