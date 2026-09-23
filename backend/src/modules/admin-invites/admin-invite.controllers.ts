import type { Request, Response } from "express";
import type { AuthedRequest } from "../../middleware/requireAuth.js";
import {
      AppError,
      handleControllerError,
      validateBody,
      validateUuid,
} from "../../utils/http.js";
import {
      checkAdminInviteService,
      createAdminInviteService,
      deleteAdminInviteService,
      listAdminInvitesService,
      redeemAdminInviteService,
} from "./admin-invite.services.js";
import { RedeemAdminInviteSchema } from "./admin-invite.validations.js";

/** POST /admin-invites — 201 { id, token, expiresAt }; raw token shown once. */
export const createAdminInvite = async (req: Request, res: Response) => {
      try {
            const session = (req as AuthedRequest).authSession;
            const invite = await createAdminInviteService(session.user.id);

            return res.status(201).json(invite);
      } catch (error) {
            return handleControllerError(res, error, "Failed to create invite");
      }
};

/** GET /admin-invites — 200 { invites: [...] }; token/tokenHash never included. */
export const listAdminInvites = async (_req: Request, res: Response) => {
      try {
            const invites = await listAdminInvitesService();
            return res.status(200).json({ invites });
      } catch (error) {
            return handleControllerError(res, error, "Failed to list invites");
      }
};

/** DELETE /admin-invites/:id — 204 idempotent on success, 404 when missing. */
export const revokeAdminInvite = async (req: Request, res: Response) => {
      try {
            // Contract: 204 | 404 only — a malformed id cannot exist, so it
            // is reported as 404 (not 400) to avoid a Postgres uuid 500.
            const id = validateUuid(req.params.id, "id");
            await deleteAdminInviteService(id);
            return res.sendStatus(204);
      } catch (error) {
            if (
                  error instanceof AppError &&
                  error.statusCode === 400 &&
                  /^Invalid id$/.test(error.message)
            ) {
                  return res.status(404).json({
                        success: false,
                        message: "Invite not found",
                  });
            }
            return handleControllerError(res, error, "Failed to revoke invite");
      }
};

/**
 * GET /public/admin-invites/:token — always 200:
 * { valid: true, expiresAt } | { valid: false, expiresAt?, reason }.
 */
export const checkAdminInvite = async (req: Request, res: Response) => {
      try {
            const token = req.params.token as string;
            const result = await checkAdminInviteService(token);
            return res.status(200).json(result);
      } catch (error) {
            return handleControllerError(res, error, "Failed to check invite");
      }
};

/** POST /public/admin-invites/redeem — 201 { userId, email }; no cookies forwarded. */
export const redeemAdminInvite = async (req: Request, res: Response) => {
      try {
            const data = validateBody(RedeemAdminInviteSchema, req.body);
            const result = await redeemAdminInviteService(data, req.headers);
            return res.status(201).json(result);
      } catch (error) {
            return handleControllerError(res, error, "Failed to redeem invite");
      }
};
