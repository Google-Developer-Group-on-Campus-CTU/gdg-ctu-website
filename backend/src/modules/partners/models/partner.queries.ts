import { asc, count, eq } from "drizzle-orm";
import { db } from "../../../config/connectDB.js";
import { Pagination } from "../../../utils/pagination.js";
import { activeOnly } from "../../../utils/activeScope.js";
import { partners } from "./partner.js";

export type PartnerRecord = typeof partners.$inferSelect;
export type NewPartnerRecord = typeof partners.$inferInsert;

export const insertPartner = async (data: NewPartnerRecord) => {
      const [partner] = await db.insert(partners).values(data).returning();
      return partner;
};

export const getPartners = async (pagination: Pagination) =>
      db
            .select()
            .from(partners)
            .orderBy(asc(partners.displayOrder), asc(partners.name))
            .limit(pagination.limit)
            .offset(pagination.offset);

export const countPartners = async () => {
      const [result] = await db.select({ total: count() }).from(partners);
      return result.total;
};

export const getPartnerById = async (id: string) => {
      const [partner] = await db
            .select()
            .from(partners)
            .where(eq(partners.id, id));
      return partner;
};

export const getPartnerBySlug = async (slug: string) => {
      const [partner] = await db
            .select()
            .from(partners)
            .where(eq(partners.slug, slug));
      return partner;
};

/** Public feed: active partners only, ordered by tier rank then display_order. */
export const getActivePartners = async () => {
      const rows = await db
            .select()
            .from(partners)
            .where(activeOnly(partners.isActive));
      const rank: Record<string, number> = {
            platinum: 0,
            gold: 1,
            silver: 2,
            community: 3,
      };
      return rows.sort(
            (a, b) =>
                  (rank[a.tier] ?? 99) - (rank[b.tier] ?? 99) ||
                  (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
                  a.name.localeCompare(b.name),
      );
};

export const updatePartner = async (
      id: string,
      data: Partial<NewPartnerRecord>,
) => {
      const [partner] = await db
            .update(partners)
            .set(data)
            .where(eq(partners.id, id))
            .returning();
      return partner;
};

export const deletePartner = async (id: string) => {
      const [partner] = await db
            .delete(partners)
            .where(eq(partners.id, id))
            .returning();
      return partner;
};
