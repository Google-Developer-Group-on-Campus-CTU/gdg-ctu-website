import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { EVENT_STATUSES, events } from "./models/event.js";

const eventDateRule = <
      T extends {
            startAt?: Date;
            endAt?: Date;
      },
>(
      data: T,
      ctx: z.RefinementCtx,
) => {
      if (data.startAt && data.endAt && data.endAt < data.startAt) {
            ctx.addIssue({
                  code: "custom",
                  message: "End date/time cannot be earlier than start date/time.",
                  path: ["endAt"],
            });
      }
};

export const EventSchema = createSelectSchema(events);

const BaseCreateEventSchema = createInsertSchema(events)
      .omit({
            id: true,
            createdAt: true,
            updatedAt: true,
            publishedAt: true,
      })
      .extend({
            title: z
                  .string()
                  .trim()
                  .min(1, { message: "Event title is required." }),
            slug: z.string().trim().min(1, { message: "Slug is required." }),
            shortDescription: z.string().nullable().optional(),
            description: z.string().nullable().optional(),
            coverMediaId: z
                  .uuid()
                  .nullable()
                  .optional()
                  .refine((val) => !val || val.length > 0, {
                        message: "Cover media ID must be a valid UUID if provided.",
                  }),
            location: z.string().trim().nullable().optional(),
            locationEmbedUrl: z
                  .url()
                  .nullable()
                  .optional()
                  .refine((val) => !val || val.length > 0, {
                        message: "Location embed URL must be a valid URL if provided.",
                  }),
            registrationEnabled: z.boolean().optional().default(false),
            registrationUrl: z
                  .string()
                  .trim()
                  .nullable()
                  .optional()
                  .refine((val) => !val || val.startsWith("https://"), {
                        message:
                              "Registration URL must be a valid https:// URL when registration is enabled.",
                  }),
            isFeatured: z.boolean().optional().default(false),
            displayOrder: z.number().int().nonnegative().optional(),
            isActive: z.boolean().optional(),
            startAt: z.coerce.date(),
            endAt: z.coerce.date(),
            status: z.enum(EVENT_STATUSES).default("draft"),
            createdBy: z
                  .string({ error: "CreatedBy is required" })
                  .trim()
                  .min(1, {
                        message: "CreatedBy must be a non‑empty string (user ID).",
                  }),
      });

export const CreateEventSchema = BaseCreateEventSchema.superRefine(
      (data, ctx) => {
            eventDateRule(data, ctx);
            if (data.registrationEnabled) {
                  if (!data.registrationUrl) {
                        ctx.addIssue({
                              code: "custom",
                              message:
                                    "Registration URL is required when registration is enabled.",
                              path: ["registrationUrl"],
                        });
                  } else {
                        // No Error-as-control-flow: the try guards only the
                        // URL parse; the https rule is a plain refinement.
                        let protocol: string | undefined;
                        try {
                              protocol = new URL(data.registrationUrl).protocol;
                        } catch {
                              protocol = undefined;
                        }
                        if (protocol !== "https:") {
                              ctx.addIssue({
                                    code: "custom",
                                    message: "Registration URL must be a valid https:// URL.",
                                    path: ["registrationUrl"],
                              });
                        }
                  }
            }
      },
);

export const UpdateEventSchema = BaseCreateEventSchema.partial()
      .refine(
            (data) => Object.keys(data).length > 0,
            "At least one field is required",
      )
      .superRefine(eventDateRule);

export type Event = z.infer<typeof EventSchema>;
export type CreateEventDTO = z.infer<typeof CreateEventSchema>;
export type UpdateEventDTO = z.infer<typeof UpdateEventSchema>;
