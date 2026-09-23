import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { mediaCollectionItems } from "./models/media-collection-item.js";

export const MediaCollectionItemRecordSchema =
      createSelectSchema(mediaCollectionItems);

export const MediaCollectionItemSchema = MediaCollectionItemRecordSchema.omit(
      {},
);

export const CreateMediaCollectionItemSchema = createInsertSchema(
      mediaCollectionItems,
)
      .omit({ addedAt: true })
      .extend({
            collectionId: z.uuid({
                  message: "Collection ID must be a valid UUID.",
            }),
            mediaId: z.uuid({ message: "Media ID must be a valid UUID." }),
            displayOrder: z.number().int().nonnegative().optional(),
            caption: z
                  .string()
                  .optional()
                  .refine((val) => !val || val.trim().length > 0, {
                        message: "Caption cannot be empty if provided.",
                  }),
            altText: z
                  .string()
                  .trim()
                  .min(1, { message: "Alt text is required." }),
            isFeatured: z.boolean().optional(),
      });

export const UpdateMediaCollectionItemSchema =
      CreateMediaCollectionItemSchema.partial().refine(
            (data) => Object.keys(data).length > 0,
            "At least one field is required",
      );

export type MediaCollectionItemRecord = z.infer<
      typeof MediaCollectionItemRecordSchema
>;
export type MediaCollectionItem = z.infer<typeof MediaCollectionItemSchema>;
export type CreateMediaCollectionItemDTO = z.infer<
      typeof CreateMediaCollectionItemSchema
>;
export type UpdateMediaCollectionItemDTO = z.infer<
      typeof UpdateMediaCollectionItemSchema
>;
