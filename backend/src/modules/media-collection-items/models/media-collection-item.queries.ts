import { asc, count, eq, and } from "drizzle-orm";
import { db } from "../../../config/connectDB";
import { Pagination } from "../../../utils/pagination";
import { activeOnly } from "../../../utils/activeScope";
import { mediaCollections } from "../../media-collections/models/media-collection";
import { media } from "../../media/models/media";
import { mediaCollectionItems } from "./media-collection-item";

export type MediaCollectionItemRecord =
      typeof mediaCollectionItems.$inferSelect;
export type NewMediaCollectionItemRecord =
      typeof mediaCollectionItems.$inferInsert;

export const insertMediaCollectionItem = async (
      data: NewMediaCollectionItemRecord,
) => {
      const [item] = await db
            .insert(mediaCollectionItems)
            .values(data)
            .returning();
      return item;
};

export const getMediaCollectionItems = async (pagination: Pagination) =>
      db
            .select()
            .from(mediaCollectionItems)
            .orderBy(asc(mediaCollectionItems.displayOrder))
            .limit(pagination.limit)
            .offset(pagination.offset);

export const countMediaCollectionItems = async () => {
      const [result] = await db
            .select({ total: count() })
            .from(mediaCollectionItems);
      return result.total;
};

export const getMediaCollectionItem = async (
      collectionId: string,
      mediaId: string,
) => {
      const [item] = await db
            .select()
            .from(mediaCollectionItems)
            .where(
                  and(
                        eq(mediaCollectionItems.collectionId, collectionId),
                        eq(mediaCollectionItems.mediaId, mediaId),
                  ),
            );
      return item;
};

/** Ordered items for one album (public detail view). */
export const getItemsByCollectionId = async (collectionId: string) =>
      db
            .select()
            .from(mediaCollectionItems)
            .where(eq(mediaCollectionItems.collectionId, collectionId))
            .orderBy(asc(mediaCollectionItems.displayOrder));

/**
 * Featured-photo strip across active albums (cap enforced by caller, max 8).
 * Returns only the fields the public mapper needs — no internal FK ids.
 */
export const getFeaturedCollectionItems = async (limit = 8) =>
      db
            .select({
                  albumSlug: mediaCollections.slug,
                  albumTitle: mediaCollections.name,
                  imageUrl: media.secureUrl,
                  itemAlt: mediaCollectionItems.altText,
                  mediaAlt: media.altText,
                  caption: mediaCollectionItems.caption,
                  order: mediaCollectionItems.displayOrder,
            })
            .from(mediaCollectionItems)
            .innerJoin(
                  mediaCollections,
                  eq(mediaCollectionItems.collectionId, mediaCollections.id),
            )
            .innerJoin(media, eq(mediaCollectionItems.mediaId, media.id))
            .where(
                  and(
                        eq(mediaCollectionItems.isFeatured, true),
                        activeOnly(mediaCollections.isActive),
                  ),
            )
            .orderBy(asc(mediaCollectionItems.displayOrder))
            .limit(limit);

export const updateMediaCollectionItem = async (
      collectionId: string,
      mediaId: string,
      data: Partial<NewMediaCollectionItemRecord>,
) => {
      const [item] = await db
            .update(mediaCollectionItems)
            .set(data)
            .where(
                  and(
                        eq(mediaCollectionItems.collectionId, collectionId),
                        eq(mediaCollectionItems.mediaId, mediaId),
                  ),
            )
            .returning();
      return item;
};

export const deleteMediaCollectionItem = async (
      collectionId: string,
      mediaId: string,
) => {
      const [item] = await db
            .delete(mediaCollectionItems)
            .where(
                  and(
                        eq(mediaCollectionItems.collectionId, collectionId),
                        eq(mediaCollectionItems.mediaId, mediaId),
                  ),
            )
            .returning();
      return item;
};
