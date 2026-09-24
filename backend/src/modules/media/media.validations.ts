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

// Full DB-record input (client-facing CreateMediaSchema omits the
// Cloudinary columns the server fills in after upload). Built on the INSERT
// schema — not the select schema — so nullable-column optionality matches
// `NewMediaRecord` and every existing `createMediaRecord(...)` call site
// stays assignable. Zod-inferred and validated at the service entry in
// createMediaService — alter tables here, not in `as any` casts.
export const MediaRecordSchema = createInsertSchema(media).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
});
export type CreateMediaInput = z.infer<typeof MediaRecordSchema>;

// Update payload: validated non-media fields plus the Cloudinary columns a
// file-swap refreshes (both optional — file-only updates send `{}` plus the
// new asset columns).
export type UpdateMediaInput = UpdateMediaDTO &
      Partial<CreateMediaInput>;

// Direct-to-Cloudinary signed upload (bulk path): the client sends this as
// JSON, receives signed params, and POSTs the file bytes straight to
// Cloudinary — bytes never transit this serverless function (dodges the
// 4.5MB request cap; see cloudinary.services signDirectUpload).
export const SignUploadSchema = z.object({
      // Optional sub-folder under the Cloudinary `GDGoC` root (same
      // convention as uploadMedia's folder option).
      folder: z
            .string()
            .trim()
            .max(128)
            .regex(/^[A-Za-z0-9][A-Za-z0-9_\-/]*$/, {
                  message:
                        "Folder may contain letters, digits, '_', '-' and '/'.",
            })
            .optional(),
      publicId: z
            .string()
            .trim()
            .max(128)
            .regex(/^[A-Za-z0-9][A-Za-z0-9_\-]*$/, {
                  message: "publicId may contain letters, digits, '_' and '-'.",
            })
            .optional(),
      resourceType: z.enum(["auto", "image", "video", "raw"]).default("auto"),
});
export type SignUploadDTO = z.infer<typeof SignUploadSchema>;

export type Media = z.infer<typeof MediaSchema>;
export type CreateMediaDTO = z.infer<typeof CreateMediaSchema>;
export type UpdateMediaDTO = z.infer<typeof UpdateMediaSchema>;
