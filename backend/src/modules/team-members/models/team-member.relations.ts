import { relations } from "drizzle-orm";
import { eventSpeakers } from "../../event-speakers/models/event-speaker";
import { memberTerms } from "../../member_terms/models/member-terms";
import { media } from "../../media/models/media";
import { teamMembers } from "./team-member";

export const teamMembersRelations = relations(teamMembers, ({ one, many }) => ({
      profileMedia: one(media, {
            fields: [teamMembers.profileMediaId],
            references: [media.id],
      }),
      memberTerms: many(memberTerms),
      eventSpeakers: many(eventSpeakers),
}));
