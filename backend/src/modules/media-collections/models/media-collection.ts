import { boolean, integer, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { user } from "../../auth/models/auth.js";
import { events } from "../../events/models/event.js";
import { media } from "../../media/models/media.js"; // reference media module

export const mediaCollections = pgTable("media_collections", {
      id: uuid("id").defaultRandom().primaryKey(),
      name: varchar("name", { length: 255 }).notNull(),
      slug: varchar("slug", { length: 255 }).notNull().unique(),
      description: text("description"),
      coverMediaId: uuid("cover_media_id").references(() => media.id),
      // Gallery album extension (spec §4.6): optional link to an event recap.
      eventId: uuid("event_id").references(() => events.id),
      // Album/showcase date.
      date: timestamp("date"),
      // Album highlight flag for the public gallery.
      isFeatured: boolean("is_featured").default(false).notNull(),
      isActive: boolean("is_active").default(true).notNull(),
      displayOrder: integer("display_order").default(0).notNull(),
      // Fold: references Better Auth's `user` table (text PK).
      createdBy: text("created_by")
            .notNull()
            .references(() => user.id),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
