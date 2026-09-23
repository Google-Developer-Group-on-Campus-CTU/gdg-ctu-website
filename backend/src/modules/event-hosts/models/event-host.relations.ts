import { relations } from "drizzle-orm";
import { events } from "../../events/models/event.js";
import { teamMembers } from "../../team-members/models/team-member.js";
import { eventHosts } from "./event-host.js";

export const eventHostsRelations = relations(eventHosts, ({ one }) => ({
      event: one(events, {
            fields: [eventHosts.eventId],
            references: [events.id],
      }),
      teamMember: one(teamMembers, {
            fields: [eventHosts.teamMemberId],
            references: [teamMembers.id],
      }),
}));
