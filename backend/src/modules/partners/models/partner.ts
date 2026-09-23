import { boolean, integer, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";
import { user } from "../../auth/models/auth.js";
import { media } from "../../media/models/media.js";

/**
 * Partner tier — public list is ordered by tier rank, then display_order.
 */
export const PARTNER_TIERS = [
      "platinum",
      "gold",
      "silver",
      "community",
] as const;

export const partners = pgTable("partners", {
      id: uuid("id").defaultRandom().primaryKey(),
      name: varchar("name", { length: 255 }).notNull(),
      slug: varchar("slug", { length: 255 }).notNull().unique(),
      logoMediaId: uuid("logo_media_id").references(() => media.id),
      websiteUrl: varchar("website_url", { length: 2048 }),
      tier: varchar("tier", { length: 50, enum: PARTNER_TIERS })
            .default("community")
            .notNull(),
      description: text("description"),
      displayOrder: integer("display_order").default(0).notNull(),
      isActive: boolean("is_active").default(true).notNull(),
      // Audit trail (spec §7) — fold: references Better Auth's `user`
      // table (text PK), same as the other audit columns.
      createdBy: text("created_by")
            .notNull()
            .references(() => user.id),
      updatedBy: text("updated_by")
            .notNull()
            .references(() => user.id),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PartnerTier = (typeof PARTNER_TIERS)[number];
