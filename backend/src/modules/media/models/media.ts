import { integer, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { user } from "../../auth/models/auth.js";

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

      // Fold: audit columns now reference Better Auth's `user` table (text PK).
      uploadedBy: text("uploaded_by")
            .notNull()
            .references(() => user.id),

      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
