import { text, timestamp, uuid, varchar, boolean, integer } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { user } from "../../auth/models/auth.js";
import { media } from "../../media/models/media.js";

/**
 * Event status enum – matches the Zod validation `EVENT_STATUSES`.
 */
export const EVENT_STATUSES = [
      "draft",
      "published",
      "archived",
      "cancelled",
] as const;

export const events = pgTable("events", {
      id: uuid("id").defaultRandom().primaryKey(),

      // Required fields – Zod will return clear messages if missing/empty.
      title: varchar("title", { length: 255 }).notNull(), // "Event title is required."
      slug: varchar("slug", { length: 255 }).notNull().unique(), // "Slug is required."

      shortDescription: text("short_description"),
      description: text("description"),

      // Optional media reference – validation ensures a proper UUID when supplied.
      coverMediaId: uuid("cover_media_id").references(() => media.id), // "Cover media ID must be a valid UUID if provided."

      // Venue information – optional strings.
      location: varchar("location", { length: 255 }),
      locationEmbedUrl: varchar("location_embed_url", { length: 2048 }),

      // Registration toggle + URL (https required when enabled, Q2=b/Q11=a).
      registrationEnabled: boolean("registration_enabled")
            .default(false)
            .notNull(),
      registrationUrl: varchar("registration_url", { length: 2048 }),

      // Home Featured strip (max 3, UI-enforced, Q15=a).
      isFeatured: boolean("is_featured").default(false).notNull(),

      displayOrder: integer("display_order").default(0).notNull(),
      isActive: boolean("is_active").default(true).notNull(),

      // Required timestamps; Zod enforces chronological order.
      startAt: timestamp("start_at").notNull(), // "Start date must be a valid date."
      endAt: timestamp("end_at").notNull(), // "End date must be a valid date."

      // Status must be one of the defined constants.
      status: varchar("status", {
            length: 50,
            enum: EVENT_STATUSES,
      })
            .default("draft")
            .notNull(), // "Status must be one of draft, published, archived, cancelled."

      publishedAt: timestamp("published_at"),

      // Fold: references Better Auth's `user` table (text PK).
      createdBy: text("created_by")
            .notNull()
            .references(() => user.id), // "CreatedBy must be a valid user ID."

      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type EventStatus = (typeof EVENT_STATUSES)[number];
