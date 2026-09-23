import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { PARTNER_TIERS, partners } from "./models/partner.js";

export const PartnerSchema = createSelectSchema(partners);

export const CreatePartnerSchema = createInsertSchema(partners)
      .omit({ id: true, createdAt: true, updatedAt: true, createdBy: true, updatedBy: true })
      .extend({
            name: z.string().trim().min(1, { message: "Name is required." }),
            slug: z.string().trim().min(1, { message: "Slug is required." }),
            logoMediaId: z
                  .uuid()
                  .nullable()
                  .optional()
                  .refine((val) => !val || val.length > 0, {
                        message: "Logo media ID must be a valid UUID if provided.",
                  }),
            websiteUrl: z
                  .string()
                  .trim()
                  .nullable()
                  .optional()
                  .refine(
                        (val) => {
                              if (!val) return true;
                              try {
                                    return new URL(val).protocol === "https:";
                              } catch {
                                    return false;
                              }
                        },
                        {
                              message: "Website URL must be a valid https:// URL if provided.",
                        },
                  ),
            tier: z.enum(PARTNER_TIERS).default("community"),
            description: z.string().nullable().optional(),
            displayOrder: z.number().int().nonnegative().optional(),
            isActive: z.boolean().optional(),
      });

export const UpdatePartnerSchema = CreatePartnerSchema.partial().refine(
      (data) => Object.keys(data).length > 0,
      "At least one field is required",
);

export type Partner = z.infer<typeof PartnerSchema>;
export type CreatePartnerDTO = z.infer<typeof CreatePartnerSchema>;
export type UpdatePartnerDTO = z.infer<typeof UpdatePartnerSchema>;
