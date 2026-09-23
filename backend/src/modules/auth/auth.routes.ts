import express from "express";
import { getCurrentAdminUser } from "./getCurrentAdminUser.controllers.js";

/**
 * App-level auth convenience routes, mounted on the protected router in
 * `modules/index.ts`, so `requireAuth` runs first (401/403/503).
 *
 * Better Auth's own sign-in / sign-up / session endpoints are NOT here —
 * they are served by the node handler mounted in `server.ts` at
 * AUTH_BASE_PATH (`/GDGoC-CTU-Main/v0.0.1/api/auth/*`).
 */
const router = express.Router();

/**
 * Returns the current Better Auth session user.
 *
 * Flow:
 * 1. `requireAuth` (applied upstream) rejects with 401/403 and caches the
 *    resolved session on `req.authSession`.
 * 2. This handler serializes that cached session — no extra DB lookup.
 *
 * (The old POST /auth/sync + Clerk `clerkClient.users.getUser` sync are gone:
 * Better Auth writes the user row at sign-up.)
 *
 * @route GET /me
 * @access Protected — requires a valid Better Auth admin session
 */
router.get("/me", getCurrentAdminUser);

export default router;
