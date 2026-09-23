import {
      boolean,
      integer,
      timestamp,
      uuid,
      varchar,
      primaryKey,
      pgTable,
} from "drizzle-orm/pg-core";
import { mediaCollections } from "../../media-collections/models/media-collection.js";
import { media } from "../../media/models/media.js";

export const mediaCollectionItems = pgTable(
      "media_collection_items",
      {
            collectionId: uuid("collection_id")
                  .notNull()
                  .references(() => mediaCollections.id),

            mediaId: uuid("media_id")
                  .notNull()
                  .references(() => media.id),

            displayOrder: integer("display_order").default(0).notNull(),

            caption: varchar("caption", { length: 255 }),

            // Item alt text (required before publish, spec §4.6).
            altText: varchar("alt_text", { length: 255 }).notNull(),

            // Featured-photo strip flag (public gallery featured feed, max 8).
            isFeatured: boolean("is_featured").default(false).notNull(),

            addedAt: timestamp("added_at").defaultNow().notNull(),
      },
      (table) => [
            primaryKey({
                  columns: [table.collectionId, table.mediaId],
            }),
      ],
);
