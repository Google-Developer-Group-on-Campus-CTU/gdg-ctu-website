import { asc, count, desc, eq } from "drizzle-orm";
import { db } from "../../../config/connectDB.js";
import { Pagination } from "../../../utils/pagination.js";
import { activeOnly } from "../../../utils/activeScope.js";
import { galleryCategories } from "./gallery-category.js";

export type GalleryCategoryRecord = typeof galleryCategories.$inferSelect;
export type NewGalleryCategoryRecord = typeof galleryCategories.$inferInsert;

export const insertGalleryCategory = async (
      data: NewGalleryCategoryRecord,
) => {
      const [category] = await db
            .insert(galleryCategories)
            .values(data)
            .returning();
      return category;
};

export const getGalleryCategories = async (pagination: Pagination) =>
      db
            .select()
            .from(galleryCategories)
            .orderBy(
                  asc(galleryCategories.displayOrder),
                  asc(galleryCategories.name),
            )
            .limit(pagination.limit)
            .offset(pagination.offset);

export const countGalleryCategories = async () => {
      const [result] = await db
            .select({ total: count() })
            .from(galleryCategories);
      return result.total;
};

export const getGalleryCategoryById = async (id: string) => {
      const [category] = await db
            .select()
            .from(galleryCategories)
            .where(eq(galleryCategories.id, id));
      return category;
};

export const getGalleryCategoryBySlug = async (slug: string) => {
      const [category] = await db
            .select()
            .from(galleryCategories)
            .where(eq(galleryCategories.slug, slug));
      return category;
};

/** Public feed: active categories only, ordered by displayOrder then name. */
export const getActiveGalleryCategories = async () =>
      db
            .select({
                  id: galleryCategories.id,
                  slug: galleryCategories.slug,
                  name: galleryCategories.name,
                  displayOrder: galleryCategories.displayOrder,
            })
            .from(galleryCategories)
            .where(activeOnly(galleryCategories.isActive))
            .orderBy(
                  asc(galleryCategories.displayOrder),
                  asc(galleryCategories.name),
            );

/** Newest-first list for admin dropdowns / public terms-style feeds. */
export const getGalleryCategoriesNewestFirst = async () =>
      db
            .select()
            .from(galleryCategories)
            .orderBy(desc(galleryCategories.createdAt));

export const updateGalleryCategory = async (
      id: string,
      data: Partial<NewGalleryCategoryRecord>,
) => {
      const [category] = await db
            .update(galleryCategories)
            .set(data)
            .where(eq(galleryCategories.id, id))
            .returning();
      return category;
};

export const deleteGalleryCategory = async (id: string) => {
      const [category] = await db
            .delete(galleryCategories)
            .where(eq(galleryCategories.id, id))
            .returning();
      return category;
};
