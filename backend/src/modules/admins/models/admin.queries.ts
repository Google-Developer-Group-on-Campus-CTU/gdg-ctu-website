import { count, eq } from "drizzle-orm";
import { db } from "../../../config/connectDB.js";
import { Pagination } from "../../../utils/pagination.js";
import { events } from "../../events/models/event.js";
import { media } from "../../media/models/media.js";
import { siteContent } from "../../site-content/models/site-content.js";
import { account, user } from "../../auth/models/auth.js";

// Fold: the old `admins` table is gone — these queries run against Better
// Auth's `user` table, where an admin is simply a row with role = "admin".
export type AdminRecord = typeof user.$inferSelect;
export type NewAdminRecord = typeof user.$inferInsert;

export const insertAdmin = async (data: NewAdminRecord) => {
      const [record] = await db.insert(user).values(data).returning();
      return record;
};

/**
 * Attach a credential (email + password) login to a user row.
 * Passwords are scrypt-hashed by Better Auth's `hashPassword` (default).
 */
export const insertCredentialAccount = async (data: {
      id: string;
      userId: string;
      passwordHash: string;
}) => {
      const [record] = await db
            .insert(account)
            .values({
                  id: data.id,
                  accountId: data.userId,
                  providerId: "credential",
                  userId: data.userId,
                  password: data.passwordHash,
            })
            .returning();
      return record;
};

// Lists every user (paginated). Callers expose `role`, so the UI can tell
// admins apart and promote regular sign-ups.
export const getAdmins = async (pagination: Pagination) =>
      db
            .select()
            .from(user)
            .limit(pagination.limit)
            .offset(pagination.offset);

export const countAdmins = async () => {
      const [result] = await db.select({ total: count() }).from(user);
      return result.total;
};

export const getAdminById = async (id: string) => {
      const [record] = await db.select().from(user).where(eq(user.id, id));
      return record;
};

export const getAdminByEmail = async (email: string) => {
      const [record] = await db
            .select()
            .from(user)
            .where(eq(user.email, email.toLowerCase()));
      return record;
};

export const updateAdmin = async (
      id: string,
      data: Partial<NewAdminRecord>,
) => {
      const [record] = await db
            .update(user)
            .set(data)
            .where(eq(user.id, id))
            .returning();
      return record;
};

export const deleteAdmin = async (id: string) => {
      const [record] = await db
            .delete(user)
            .where(eq(user.id, id))
            .returning();
      return record;
};

export const adminHasReferences = async (id: string) => {
      const [event] = await db
            .select({ id: events.id })
            .from(events)
            .where(eq(events.createdBy, id))
            .limit(1);

      const [uploadedMedia] = await db
            .select({ id: media.id })
            .from(media)
            .where(eq(media.uploadedBy, id))
            .limit(1);

      const [content] = await db
            .select({ id: siteContent.id })
            .from(siteContent)
            .where(eq(siteContent.updatedBy, id))
            .limit(1);

      return Boolean(event || uploadedMedia || content);
};
