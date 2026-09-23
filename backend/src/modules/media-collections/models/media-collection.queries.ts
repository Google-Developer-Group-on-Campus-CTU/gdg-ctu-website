import { asc, count, eq } from "drizzle-orm";
import { db } from "../../../config/connectDB.js";
import { Pagination } from "../../../utils/pagination.js";
import { activeByKey, activeOnly } from "../../../utils/activeScope.js";
import { mediaCollections } from "./media-collection.js";

export type MediaCollectionRecord = typeof mediaCollections.$inferSelect;
export type NewMediaCollectionRecord = typeof mediaCollections.$inferInsert;

export const insertMediaCollection = async (data: NewMediaCollectionRecord) => {
      const [col] = await db.insert(mediaCollections).values(data).returning();
      return col;
};

export const getMediaCollections = async (pagination: Pagination) =>
      db
            .select()
            .from(mediaCollections)
            .orderBy(asc(mediaCollections.createdAt))
            .limit(pagination.limit)
            .offset(pagination.offset);

export const countMediaCollections = async () => {
      const [result] = await db.select({ total: count() }).from(mediaCollections);
      return result.total;
};

export const getMediaCollectionById = async (id: string) => {
      const [col] = await db.select().from(mediaCollections).where(eq(mediaCollections.id, id));
      return col;
};

export const getMediaCollectionBySlug = async (slug: string) => {
      const [col] = await db.select().from(mediaCollections).where(eq(mediaCollections.slug, slug));
      return col;
};

/** Public feed: active albums only. */
export const getActiveMediaCollections = async () =>
      db
            .select()
            .from(mediaCollections)
            .where(activeOnly(mediaCollections.isActive))
            .orderBy(asc(mediaCollections.displayOrder), asc(mediaCollections.name));

export const getActiveMediaCollectionBySlug = async (slug: string) => {
      const [col] = await db
            .select()
            .from(mediaCollections)
            .where(
                  activeByKey(
                        mediaCollections.slug,
                        mediaCollections.isActive,
                        slug,
                  ),
            );
      return col;
};

export const updateMediaCollection = async (id: string, data: Partial<NewMediaCollectionRecord>) => {
      const [col] = await db.update(mediaCollections).set(data).where(eq(mediaCollections.id, id)).returning();
      return col;
};

export const deleteMediaCollection = async (id: string) => {
      const [col] = await db.delete(mediaCollections).where(eq(mediaCollections.id, id)).returning();
      return col;
};
