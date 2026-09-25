import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { mediaCollections } from "./models/media-collection.js";
import { nullableUuid } from "../../utils/zodHelpers.js";

export const MediaCollectionRecordSchema = createSelectSchema(mediaCollections);

export const MediaCollectionSchema = MediaCollectionRecordSchema.omit({});

export const CreateMediaCollectionSchema = createInsertSchema(mediaCollections)
      .omit({ id: true, createdAt: true, updatedAt: true })
      .extend({
            name: z
                  .string()
                  .min(1, { message: "Collection name is required." }),
            slug: z.string().min(1, { message: "Slug is required." }),
            description: z.string().optional(),
            coverMediaId: z
                  .uuid()
                  .optional()
                  .nullable()
                  .refine((val) => !val || val.length > 0, {
                        message: "Cover media ID must be a valid UUID if provided.",
                  }),
            createdBy: z
                  .string()
                  .trim()
                  .min(1, {
                        message: "CreatedBy must be a non‑empty string (user ID).",
                  }),
            eventId: z.uuid().nullable().optional(),
            categoryId: nullableUuid(
                  "Category ID must be a valid UUID if provided.",
            ),
            date: z.coerce.date().nullable().optional(),
            isFeatured: z.boolean().optional(),
            isActive: z.boolean().optional(),
            displayOrder: z.number().int().nonnegative().optional(),
      });

export const UpdateMediaCollectionSchema =
      CreateMediaCollectionSchema.partial().refine(
            (data) => Object.keys(data).length > 0,
            "At least one field is required",
      );

export type MediaCollectionRecord = z.infer<typeof MediaCollectionRecordSchema>;
export type MediaCollection = z.infer<typeof MediaCollectionSchema>;
export type CreateMediaCollectionDTO = z.infer<
      typeof CreateMediaCollectionSchema
>;
export type UpdateMediaCollectionDTO = z.infer<
      typeof UpdateMediaCollectionSchema
>;
