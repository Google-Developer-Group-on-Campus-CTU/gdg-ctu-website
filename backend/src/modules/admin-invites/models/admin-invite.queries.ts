import { desc, eq } from "drizzle-orm";
import { db } from "../../../config/connectDB.js";
import { adminInvites } from "./admin-invite.js";

export type AdminInviteRecord = typeof adminInvites.$inferSelect;
export type NewAdminInviteRecord = typeof adminInvites.$inferInsert;

/** Columns safe to expose on GET /admin-invites — never tokenHash. */
export type AdminInviteListItem = Pick<
      AdminInviteRecord,
      "id" | "createdAt" | "expiresAt" | "usedAt" | "usedBy" | "createdBy"
>;

export const insertAdminInvite = async (data: NewAdminInviteRecord) => {
      const [invite] = await db.insert(adminInvites).values(data).returning();
      return invite;
};

/**
 * Newest first. Selected columns are the public shape — `tokenHash` is
 * not part of the select list, so it cannot leak through the list route.
 */
export const listAdminInvites = async (): Promise<AdminInviteListItem[]> =>
      db
            .select({
                  id: adminInvites.id,
                  createdAt: adminInvites.createdAt,
                  expiresAt: adminInvites.expiresAt,
                  usedAt: adminInvites.usedAt,
                  usedBy: adminInvites.usedBy,
                  createdBy: adminInvites.createdBy,
            })
            .from(adminInvites)
            .orderBy(desc(adminInvites.createdAt));

/** Lookup by sha256-hex digest (both sides fixed-length hex). */
export const getAdminInviteByTokenHash = async (tokenHash: string) => {
      const [invite] = await db
            .select()
            .from(adminInvites)
            .where(eq(adminInvites.tokenHash, tokenHash));
      return invite;
};

export const getAdminInviteById = async (id: string) => {
      const [invite] = await db
            .select()
            .from(adminInvites)
            .where(eq(adminInvites.id, id));
      return invite;
};

export const deleteAdminInvite = async (id: string) => {
      const deleted = await db
            .delete(adminInvites)
            .where(eq(adminInvites.id, id))
            .returning({ id: adminInvites.id });
      return deleted[0];
};
