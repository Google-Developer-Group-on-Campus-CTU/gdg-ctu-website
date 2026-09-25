import { count, desc, eq } from "drizzle-orm";
import { db } from "../../../config/connectDB.js";
import { Pagination } from "../../../utils/pagination.js";
import { contactMessages } from "./contact-message.js";

export type ContactMessageRecord = typeof contactMessages.$inferSelect;
export type NewContactMessageRecord = typeof contactMessages.$inferInsert;

export const insertContactMessage = async (
      data: NewContactMessageRecord,
) => {
      const [row] = await db
            .insert(contactMessages)
            .values(data)
            .returning();
      return row;
};

export const getContactMessages = async (pagination: Pagination) =>
      db
            .select()
            .from(contactMessages)
            .orderBy(desc(contactMessages.createdAt))
            .limit(pagination.limit)
            .offset(pagination.offset);

export const countContactMessages = async () => {
      const [result] = await db
            .select({ total: count() })
            .from(contactMessages);
      return result.total;
};

export const getContactMessageById = async (id: string) => {
      const [row] = await db
            .select()
            .from(contactMessages)
            .where(eq(contactMessages.id, id));
      return row;
};

export const updateContactMessage = async (
      id: string,
      data: Partial<NewContactMessageRecord>,
) => {
      const [row] = await db
            .update(contactMessages)
            .set(data)
            .where(eq(contactMessages.id, id))
            .returning();
      return row;
};

export const deleteContactMessage = async (id: string) => {
      const [row] = await db
            .delete(contactMessages)
            .where(eq(contactMessages.id, id))
            .returning();
      return row;
};
