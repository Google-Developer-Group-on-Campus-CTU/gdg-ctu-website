import { relations } from "drizzle-orm";
import { memberTerms } from "../../member_terms/models/member-terms.js";
import { media } from "../../media/models/media.js";
import { teamMembers } from "./team-member.js";

export const teamMembersRelations = relations(teamMembers, ({ one, many }) => ({
      profileMedia: one(media, {
            fields: [teamMembers.profileMediaId],
            references: [media.id],
      }),
      memberTerms: many(memberTerms),
}));
