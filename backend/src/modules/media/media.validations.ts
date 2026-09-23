import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { media } from "./models/media.js";

export const MediaSchema = createSelectSchema(media);

export const CreateMediaSchema = createInsertSchema(media)
      .omit({
            id: true,
            createdAt: true,
            updatedAt: true,
            cloudinaryAssetId: true,
            publicId: true,
            secureUrl: true,
            resourceType: true,
            format: true,
            width: true,
            height: true,
            bytes: true,
            originalFilename: true,
      })
      .extend({
            uploadedBy: z.string().trim().min(1, {
                  message: "Uploader ID must be a non‑empty string.",
            }),
            altText: z.string().trim().nullable().optional(),
      });

export const UpdateMediaSchema = CreateMediaSchema.partial().refine(
      (data) => Object.keys(data).length > 0,
      "At least one field is required",
);

export type Media = z.infer<typeof MediaSchema>;
export type CreateMediaDTO = z.infer<typeof CreateMediaSchema>;
export type UpdateMediaDTO = z.infer<typeof UpdateMediaSchema>;
