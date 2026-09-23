import { relations } from "drizzle-orm";
import { events } from "../../events/models/event.js";
import { eventAttendees } from "./event-attendee.js";

export const eventAttendeesRelations = relations(eventAttendees, ({ one }) => ({
      event: one(events, {
            fields: [eventAttendees.eventId],
            references: [events.id],
      }),
}));
