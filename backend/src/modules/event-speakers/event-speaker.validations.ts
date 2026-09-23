import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eventSpeakers } from "./models/event-speaker.js";

export const EventSpeakerSchema = createSelectSchema(eventSpeakers);

export const CreateEventSpeakerSchema = createInsertSchema(eventSpeakers)
      .omit({
            id: true,
            createdAt: true,
            updatedAt: true,
      })
      .extend({
            firstName: z
                  .string()
                  .trim()
                  .min(1, { message: "First name is required." }),
            lastName: z
                  .string()
                  .trim()
                  .min(1, { message: "Last name is required." }),
            slug: z.string().trim().min(1, { message: "Slug is required." }),
            role: z.string().trim().nullable().optional(),
            bio: z.string().nullable().optional(),
            profileMediaId: z
                  .uuid()
                  .nullable()
                  .optional()
                  .refine((val) => !val || val.length > 0, {
                        message: "Profile Media ID must be a valid UUID if provided.",
                  }),
            linkedinUrl: z
                  .url()
                  .nullable()
                  .optional()
                  .refine((val) => !val || val.length > 0, {
                        message: "LinkedIn URL must be a valid URL if provided.",
                  }),
            githubUrl: z
                  .url()
                  .nullable()
                  .optional()
                  .refine((val) => !val || val.length > 0, {
                        message: "GitHub URL must be a valid URL if provided.",
                  }),
            websiteUrl: z
                  .url()
                  .nullable()
                  .optional()
                  .refine((val) => !val || val.length > 0, {
                        message: "Website URL must be a valid URL if provided.",
                  }),
            teamMemberId: z
                  .uuid()
                  .nullable()
                  .optional()
                  .refine((val) => !val || val.length > 0, {
                        message: "Team Member ID must be a valid UUID if provided.",
                  }),
      });

export const UpdateEventSpeakerSchema =
      CreateEventSpeakerSchema.partial().refine(
            (data) => Object.keys(data).length > 0,
            "At least one field is required",
      );

export type EventSpeaker = z.infer<typeof EventSpeakerSchema>;
export type CreateEventSpeakerDTO = z.infer<typeof CreateEventSpeakerSchema>;
export type UpdateEventSpeakerDTO = z.infer<typeof UpdateEventSpeakerSchema>;
