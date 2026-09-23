import {
      boolean,
      integer,
      text,
      timestamp,
      uuid,
      varchar,
} from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { admins } from "../../admins/models/admin";
// import { events } from "../../events/models/event"; // removed to break circular dependency // keep for potential future use, but not used in FK to avoid circular import
import type { media } from "../../media/models/media"; // type-only import to avoid circular runtime dependency

export const mediaCollections = pgTable("media_collections", {
      id: uuid("id").defaultRandom().primaryKey(),
      name: varchar("name", { length: 255 }).notNull(),
      slug: varchar("slug", { length: 255 }).notNull().unique(),
      description: text("description"),
      coverMediaId: uuid("cover_media_id"),
      // Gallery album extension (spec §4.6): optional link to an event recap.
      // Optional link to an event recap – stored as plain UUID to avoid circular FK.
      eventId: uuid("event_id"),
      // Album/showcase date.
      date: timestamp("date"),
      // Album highlight flag for the public gallery.
      isFeatured: boolean("is_featured").default(false).notNull(),
      isActive: boolean("is_active").default(true).notNull(),
      displayOrder: integer("display_order").default(0).notNull(),
      createdBy: varchar("created_by")
            .notNull()
            .references(() => admins.id),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
