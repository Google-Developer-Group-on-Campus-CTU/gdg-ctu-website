import {
      boolean,
      integer,
      pgTable,
      timestamp,
      unique,
      uuid,
      varchar,
} from "drizzle-orm/pg-core";
import { media } from "../../media/models/media.js";
import { teamMembers } from "../../team-members/models/team-member.js";
import { terms } from "../../terms/models/terms.js";

export const memberTerms = pgTable(
      "member_terms",
      {
            id: uuid("id").defaultRandom().primaryKey(),
            memberId: uuid("member_id")
                  .notNull()
                  .references(() => teamMembers.id, {
                        onDelete: "cascade",
                        onUpdate: "cascade",
                  }),
            termId: uuid("term_id")
                  .notNull()
                  .references(() => terms.id, {
                        onDelete: "cascade",
                        onUpdate: "cascade",
                  }),

            role: varchar("role", { length: 255 }).notNull(),
            // Term photos are historical snapshots. Continuing officers can update
            // their current/default avatar without changing past term rosters.
            profileMediaId: uuid("profile_media_id").references(() => media.id),
            displayOrder: integer("display_order").default(0).notNull(),
            isActive: boolean("is_active").default(true).notNull(),
            createdAt: timestamp("created_at").defaultNow().notNull(),
            updatedAt: timestamp("updated_at").defaultNow().notNull(),
      },

      (table) => [
            unique("member_terms_member_id_term_id_unique").on(
                  table.memberId,
                  table.termId,
            ),
      ],
);
