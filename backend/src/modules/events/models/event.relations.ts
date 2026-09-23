import { relations } from "drizzle-orm";
import { user } from "../../auth/models/auth.js";
import { media } from "../../media/models/media.js";
import { events } from "./event.js";

export const eventsRelations = relations(events, ({ one }) => ({
      creator: one(user, {
            fields: [events.createdBy],
            references: [user.id],
      }),
      coverMedia: one(media, {
            fields: [events.coverMediaId],
            references: [media.id],
      }),
}));
