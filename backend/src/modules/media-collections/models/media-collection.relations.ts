import { relations } from "drizzle-orm";
import { media } from "../../media/models/media.js";
import { user } from "../../auth/models/auth.js";
import { mediaCollections } from "./media-collection.js";

export const mediaCollectionsRelations = relations(
      mediaCollections,
      ({ one, many }) => ({
            coverMedia: one(media, {
                  fields: [mediaCollections.coverMediaId],
                  references: [media.id],
            }),
            createdByUser: one(user, {
                  fields: [mediaCollections.createdBy],
                  references: [user.id],
            }),
            // items relation omitted to avoid circular dependency
      }),
);
