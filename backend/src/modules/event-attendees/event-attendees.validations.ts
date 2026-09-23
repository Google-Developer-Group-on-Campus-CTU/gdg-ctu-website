import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eventAttendees } from "./models/event-attendee.js";

export const EventAttendeeRecordSchema = createSelectSchema(eventAttendees);

export const EventAttendeeSchema = EventAttendeeRecordSchema.omit({});

export const CreateEventAttendeeSchema = createInsertSchema(eventAttendees)
      .omit({ id: true, createdAt: true, updatedAt: true, registeredAt: true })
      .extend({
            eventId: z.uuid({ message: "Event ID must be a valid UUID." }),
            firstName: z
                  .string()
                  .min(1, { message: "First name is required." }),
            lastName: z.string().min(1, { message: "Last name is required." }),
            email: z.email({
                  message: "Please provide a valid email address.",
            }),
            phone: z
                  .string()
                  .optional()
                  .refine((val) => !val || val.trim().length > 0, {
                        message: "Phone number cannot be empty if provided.",
                  }),
            organization: z
                  .string()
                  .optional()
                  .refine((val) => !val || val.trim().length > 0, {
                        message: "Organization cannot be empty if provided.",
                  }),
            jobTitle: z
                  .string()
                  .optional()
                  .refine((val) => !val || val.trim().length > 0, {
                        message: "Job title cannot be empty if provided.",
                  }),
            registrationStatus: z
                  .string()
                  .min(1, { message: "Registration status is required." }),
            attendedAt: z.date().optional(),
      });

export const UpdateEventAttendeeSchema =
      CreateEventAttendeeSchema.partial().refine(
            (data) => Object.keys(data).length > 0,
            "At least one field is required",
      );

export type EventAttendeeRecord = z.infer<typeof EventAttendeeRecordSchema>;
export type EventAttendee = z.infer<typeof EventAttendeeSchema>;
export type CreateEventAttendeeDTO = z.infer<typeof CreateEventAttendeeSchema>;
export type UpdateEventAttendeeDTO = z.infer<typeof UpdateEventAttendeeSchema>;
