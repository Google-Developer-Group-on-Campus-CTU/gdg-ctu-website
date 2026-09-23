import { Router } from "express";
import { validateParams } from "../../middleware/validateParams.js";
import {
      checkAdminInvite,
      redeemAdminInvite,
} from "./admin-invite.controllers.js";

/**
 * Public invite endpoints — no auth. Mounted via `publicMounts` in
 * `modules/index.ts` at /public/admin-invites.
 *
 * GET  /public/admin-invites/:token → 200 { valid, expiresAt?, reason? }
 * POST /public/admin-invites/redeem → 201 { userId, email } | 404 | 409 | 410
 *
 * Order matters: "/redeem" is registered before "/:token" so a POST to
 * /redeem never falls into the param route (and GET /redeem would 404 at
 * the param handler with an invalid-token result — both are POST/GET
 * distinct here, but explicit-first keeps intent clear).
 */
const router = Router();

router.post("/redeem", redeemAdminInvite);
router.get("/:token", validateParams("token"), checkAdminInvite);

export default router;
