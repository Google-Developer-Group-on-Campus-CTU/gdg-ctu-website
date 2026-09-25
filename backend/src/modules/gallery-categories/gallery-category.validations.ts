import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { galleryCategories } from "./models/gallery-category.js";

export const GalleryCategorySchema = createSelectSchema(galleryCategories);

export const CreateGalleryCategorySchema = createInsertSchema(galleryCategories)
      .omit({ id: true, createdAt: true, updatedAt: true })
      .extend({
            name: z.string().trim().min(1, { message: "Name is required." }),
            slug: z.string().trim().min(1, { message: "Slug is required." }),
            displayOrder: z.number().int().nonnegative().optional(),
            isActive: z.boolean().optional(),
      });

export const UpdateGalleryCategorySchema =
      CreateGalleryCategorySchema.partial().refine(
            (data) => Object.keys(data).length > 0,
            "At least one field is required",
      );

export type GalleryCategory = z.infer<typeof GalleryCategorySchema>;
export type CreateGalleryCategoryDTO = z.infer<
      typeof CreateGalleryCategorySchema
>;
export type UpdateGalleryCategoryDTO = z.infer<
      typeof UpdateGalleryCategorySchema
>;
