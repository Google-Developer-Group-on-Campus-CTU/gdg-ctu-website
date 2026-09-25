import { relations } from "drizzle-orm";
import { mediaCollections } from "../../media-collections/models/media-collection.js";
import { galleryCategories } from "./gallery-category.js";

export const galleryCategoriesRelations = relations(
      galleryCategories,
      ({ many }) => ({
            collections: many(mediaCollections),
      }),
);
