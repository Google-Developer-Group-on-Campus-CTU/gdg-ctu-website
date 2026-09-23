import { relations } from "drizzle-orm";
import { media } from "../../media/models/media.js";
import { partners } from "./partner.js";

export const partnersRelations = relations(partners, ({ one }) => ({
      logoMedia: one(media, {
            fields: [partners.logoMediaId],
            references: [media.id],
      }),
}));
