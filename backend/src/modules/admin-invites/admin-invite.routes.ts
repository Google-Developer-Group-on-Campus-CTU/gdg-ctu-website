import { Router } from "express";
import { validateParams } from "../../middleware/validateParams.js";
import {
      createAdminInvite,
      listAdminInvites,
      revokeAdminInvite,
} from "./admin-invite.controllers.js";

/**
 * Admin-only invite management. Mounted on the protected router in
 * `modules/index.ts`, so `requireAuth` (401/403/503) runs first.
 *
 * POST   /admin-invites      → 201 { id, token, expiresAt }
 * GET    /admin-invites      → 200 { invites: [...] }
 * DELETE /admin-invites/:id  → 204 | 404
 */
const router = Router();

router.post("/", createAdminInvite);
router.get("/", listAdminInvites);
router.delete("/:id", validateParams("id"), revokeAdminInvite);

export default router;
