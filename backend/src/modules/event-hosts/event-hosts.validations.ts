import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { eventHosts } from "./models/event-host.js";

export const EventHostRecordSchema = createSelectSchema(eventHosts);

export const EventHostSchema = EventHostRecordSchema.omit({}); // no fields omitted for now

export const CreateEventHostSchema = createInsertSchema(eventHosts)
      .omit({ id: true })
      .extend({
            eventId: z.uuid({ message: "Event ID must be a valid UUID." }),
            teamMemberId: z.uuid({
                  message: "Team member ID must be a valid UUID.",
            }),
            hostRole: z.string().min(1, { message: "Host role is required." }),
            displayOrder: z.number().int().nonnegative().optional(),
      });

export const UpdateEventHostSchema = CreateEventHostSchema.partial().refine(
      (data) => Object.keys(data).length > 0,
      "At least one field is required",
);

export type EventHostRecord = z.infer<typeof EventHostRecordSchema>;
export type EventHost = z.infer<typeof EventHostSchema>;
export type CreateEventHostDTO = z.infer<typeof CreateEventHostSchema>;
export type UpdateEventHostDTO = z.infer<typeof UpdateEventHostSchema>;
