import { integer, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { admins } from "../../admins/models/admin";
import { mediaCollections } from "../../media-collections/models/media-collection";

export const media = pgTable("media", {
      id: uuid("id").defaultRandom().primaryKey(),

      cloudinaryAssetId: varchar("cloudinary_asset_id", {
            length: 255,
      })
            .notNull()
            .unique(),

      publicId: varchar("public_id", {
            length: 255,
      })
            .notNull()
            .unique(),

      secureUrl: text("secure_url").notNull(),

      resourceType: varchar("resource_type", {
            length: 50,
      }).notNull(),

      format: varchar("format", {
            length: 50,
      }),

      width: integer("width"),
      height: integer("height"),
      bytes: integer("bytes"),

      originalFilename: varchar("original_filename", {
            length: 255,
      }),

      altText: varchar("alt_text", {
            length: 255,
      }),

      // New field to in replacement of junction table media-collection-items
      collectionId: uuid("collection_id").references(
            () => mediaCollections.id,
            {
                  onDelete: "set null",
            },
      ),

      uploadedBy: varchar("uploaded_by")
            .notNull()
            .references(() => admins.id),

      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
