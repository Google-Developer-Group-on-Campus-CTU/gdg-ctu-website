import { relations } from "drizzle-orm";
import { user } from "../../auth/models/auth.js";
import { media } from "../../media/models/media.js";
import { siteContent } from "./site-content.js";

export const siteContentRelations = relations(siteContent, ({ one }) => ({
      media: one(media, {
            fields: [siteContent.mediaId],
            references: [media.id],
      }),
      updater: one(user, {
            fields: [siteContent.updatedBy],
            references: [user.id],
      }),
}));
