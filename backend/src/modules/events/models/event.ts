import { text, timestamp, uuid, varchar, boolean } from "drizzle-orm/pg-core";
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

/**
 * Event category enum – matches the Zod validation `EVENT_CATEGORIES`.
 */
export const EVENT_CATEGORIES = [
      "Meetup",
      "Workshop",
      "Talk",
      "Competition",
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

      // External link (registration form, livestream, recap, …) — plain
      // nullable https URL, validated in Zod.
      externalUrl: varchar("external_url", { length: 2048 }),

      // IANA timezone for interpreting/displaying startAt/endAt.
      timezone: varchar("timezone", { length: 64 })
            .default("Asia/Manila")
            .notNull(),

      // Category must be one of the defined constants.
      category: varchar("category", {
            length: 32,
            enum: EVENT_CATEGORIES,
      })
            .default("Meetup")
            .notNull(), // "Category must be one of Meetup, Workshop, Talk, Competition."

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
export type EventCategory = (typeof EVENT_CATEGORIES)[number];
