import { relations } from "drizzle-orm";
import { media } from "../../media/models/media.js";
import { teamMembers } from "../../team-members/models/team-member.js";
import { eventSpeakers } from "./event-speaker.js";

export const eventSpeakersRelations = relations(eventSpeakers, ({ one }) => ({
      teamMember: one(teamMembers, {
            fields: [eventSpeakers.teamMemberId],
            references: [teamMembers.id],
      }),
      profileMedia: one(media, {
            fields: [eventSpeakers.profileMediaId],
            references: [media.id],
      }),
}));
