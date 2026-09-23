import { asc, count, desc, eq } from "drizzle-orm";
import { db } from "../../../config/connectDB.js";
import { Pagination } from "../../../utils/pagination.js";
import { terms } from "./terms.js";

export type TermRecord = typeof terms.$inferSelect;
export type NewTermRecord = typeof terms.$inferInsert;

export const insertTerm = async (data: NewTermRecord) => {
      const [term] = await db.insert(terms).values(data).returning();
      return term;
};

export const getTerms = async (pagination: Pagination) =>
      db
            .select()
            .from(terms)
            .orderBy(desc(terms.startDate))
            .limit(pagination.limit)
            .offset(pagination.offset);

export const countTerms = async () => {
      const [result] = await db.select({ total: count() }).from(terms);
      return result.total;
};

export const getTermById = async (id: string) => {
      const [term] = await db.select().from(terms).where(eq(terms.id, id));
      return term;
};

// Retrieve a term by its unique name – used to enforce name uniqueness on creation
export const getTermByName = async (name: string) => {
      const [term] = await db.select().from(terms).where(eq(terms.name, name));
      return term;
};

export const updateTerm = async (id: string, data: Partial<NewTermRecord>) => {
      const [term] = await db
            .update(terms)
            .set(data)
            .where(eq(terms.id, id))
            .returning();
      return term;
};

export const deleteTerm = async (id: string) => {
      const [term] = await db.delete(terms).where(eq(terms.id, id)).returning();
      return term;
};
