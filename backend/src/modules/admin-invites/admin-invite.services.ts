import { createHash, randomBytes } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { eq } from "drizzle-orm";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../../config/auth.js";
import { db } from "../../config/connectDB.js";
import { AppError } from "../../utils/http.js";
import logger from "../../utils/logger.js";
import { user } from "../auth/models/auth.js";
import { adminInvites } from "./models/admin-invite.js";
import {
      deleteAdminInvite,
      getAdminInviteByTokenHash,
      insertAdminInvite,
      listAdminInvites,
} from "./models/admin-invite.queries.js";
import type { RedeemAdminInviteDTO } from "./admin-invite.validations.js";

/** Invite links are valid for 72 hours from creation. */
const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

/** sha256 hex — fixed 64 chars on both sides of every comparison. */
export const sha256Hex = (token: string): string =>
      createHash("sha256").update(token, "utf8").digest("hex");

/**
 * Creates an invite: raw base64url token returned once (201 body), only the
 * sha256 hex digest is persisted.
 */
export const createAdminInviteService = async (createdBy: string) => {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = sha256Hex(token);
      const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

      const invite = await insertAdminInvite({
            tokenHash,
            createdBy,
            expiresAt,
      });

      logger.info("Admin invite created", {
            id: invite.id,
            createdBy,
            expiresAt: expiresAt.toISOString(),
      });

      // Raw `token` leaves the server here and nowhere else.
      return { id: invite.id, token, expiresAt: invite.expiresAt };
};

export const listAdminInvitesService = async () => listAdminInvites();

/** Revoke = delete the row; 404 when it does not exist. */
export const deleteAdminInviteService = async (id: string) => {
      const deleted = await deleteAdminInvite(id);
      if (!deleted) {
            throw new AppError(404, "Invite not found");
      }
      logger.info("Admin invite revoked", { id });
};

export type AdminInviteCheckResult = {
      valid: boolean;
      expiresAt?: string;
      reason?: "invalid" | "used" | "expired";
};

/**
 * Token probe for the public redeem page. Always a structured result —
 * unknown/used/expired all resolve (controller answers 200), they never throw.
 */
export const checkAdminInviteService = async (
      token: string,
): Promise<AdminInviteCheckResult> => {
      const invite = await getAdminInviteByTokenHash(sha256Hex(token));

      if (!invite) {
            return { valid: false, reason: "invalid" };
      }

      const expiresAt = invite.expiresAt.toISOString();
      if (invite.usedAt) {
            return { valid: false, expiresAt, reason: "used" };
      }
      if (invite.expiresAt.getTime() <= Date.now()) {
            return { valid: false, expiresAt, reason: "expired" };
      }
      return { valid: true, expiresAt };
};

/**
 * Redeem flow, in one transaction (invite row locked FOR UPDATE so two
 * concurrent redemptions of the same token cannot both pass the usedAt gate):
 *
 * 404 unknown → 410 used/expired → 409 email already registered →
 * auth.api.signUpEmail → promote row (role=admin, emailVerified=true) →
 * mark invite used (usedAt, usedBy) → 201 { userId, email }.
 *
 * The session token returned by signUpEmail is discarded and no set-cookie
 * headers are forwarded (`returnHeaders` not used) — the frontend signs in
 * separately after redeeming.
 *
 * Note: Better Auth's drizzle adapter writes user/account rows through the
 * shared pool rather than this tx's connection, so those two writes commit
 * independently; the invite consumption itself is atomic with the checks.
 */
export const redeemAdminInviteService = async (
      data: RedeemAdminInviteDTO,
      headers: IncomingHttpHeaders,
) => {
      const tokenHash = sha256Hex(data.token);

      return db.transaction(async (tx) => {
            const [invite] = await tx
                  .select()
                  .from(adminInvites)
                  .where(eq(adminInvites.tokenHash, tokenHash))
                  .for("update");

            if (!invite) {
                  throw new AppError(404, "Invalid invite token");
            }
            if (invite.usedAt) {
                  throw new AppError(410, "Invite already used");
            }
            if (invite.expiresAt.getTime() <= Date.now()) {
                  throw new AppError(410, "Invite expired");
            }

            const [existing] = await tx
                  .select({ id: user.id })
                  .from(user)
                  .where(eq(user.email, data.email))
                  .limit(1);
            if (existing) {
                  throw new AppError(409, "Email already registered");
            }

            const result = await auth.api.signUpEmail({
                  body: {
                        name: data.name,
                        email: data.email,
                        password: data.password,
                  },
                  headers: fromNodeHeaders(headers),
            });
            const userId = result.user.id;

            await tx
                  .update(user)
                  .set({
                        role: "admin",
                        emailVerified: true,
                        updatedAt: new Date(),
                  })
                  .where(eq(user.id, userId));

            await tx
                  .update(adminInvites)
                  .set({ usedAt: new Date(), usedBy: userId })
                  .where(eq(adminInvites.id, invite.id));

            logger.info("Admin invite redeemed", {
                  inviteId: invite.id,
                  userId,
                  email: data.email,
            });

            return { userId, email: data.email };
      });
};
