import { asc, count, eq } from "drizzle-orm";
import { db } from "../../../config/connectDB.js";
import { Pagination } from "../../../utils/pagination.js";
import { activeByKey, activeOnly } from "../../../utils/activeScope.js";
import { galleryCategories } from "../../gallery-categories/models/gallery-category.js";
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

/** Category shape embedded in public album payloads. */
const categoryShape = {
      id: galleryCategories.id,
      slug: galleryCategories.slug,
      name: galleryCategories.name,
} as const;

const toAlbumWithCategory = <
      T extends Record<string, unknown>,
      C extends { id: string; slug: string; name: string } | null,
>(
      album: T,
      category: C,
) => ({ ...album, category });

/** Public feed with joined category + optional server-side category filter. */
export const getActiveMediaCollectionsWithCategory = async (
      categorySlug?: string,
) => {
      const rows = await db
            .select({ album: mediaCollections, category: categoryShape })
            .from(mediaCollections)
            .leftJoin(
                  galleryCategories,
                  eq(mediaCollections.categoryId, galleryCategories.id),
            )
            .where(activeOnly(mediaCollections.isActive))
            .orderBy(
                  asc(mediaCollections.displayOrder),
                  asc(mediaCollections.name),
            );
      const mapped = rows.map(({ album, category }) =>
            toAlbumWithCategory(album, category?.id ? category : null),
      );
      if (!categorySlug) return mapped;
      return mapped.filter((a) => a.category?.slug === categorySlug);
};

export const getActiveMediaCollectionBySlugWithCategory = async (
      slug: string,
) => {
      const [row] = await db
            .select({ album: mediaCollections, category: categoryShape })
            .from(mediaCollections)
            .leftJoin(
                  galleryCategories,
                  eq(mediaCollections.categoryId, galleryCategories.id),
            )
            .where(
                  activeByKey(
                        mediaCollections.slug,
                        mediaCollections.isActive,
                        slug,
                  ),
            );
      if (!row) return undefined;
      return toAlbumWithCategory(
            row.album,
            row.category?.id ? row.category : null,
      );
};

export const updateMediaCollection = async (id: string, data: Partial<NewMediaCollectionRecord>) => {
      const [col] = await db.update(mediaCollections).set(data).where(eq(mediaCollections.id, id)).returning();
      return col;
};

export const deleteMediaCollection = async (id: string) => {
      const [col] = await db.delete(mediaCollections).where(eq(mediaCollections.id, id)).returning();
      return col;
};
