import { relations } from "drizzle-orm";
import { memberTerms } from "./member-terms.js";
import { media } from "../../media/models/media.js";
import { teamMembers } from "../../team-members/models/team-member.js";
import { terms } from "../../terms/models/terms.js";

export const memberTermsRelations = relations(memberTerms, ({ one }) => ({
      member: one(teamMembers, {
            fields: [memberTerms.memberId],
            references: [teamMembers.id],
      }),

      term: one(terms, {
            fields: [memberTerms.termId],
            references: [terms.id],
      }),

      profileMedia: one(media, {
            fields: [memberTerms.profileMediaId],
            references: [media.id],
      }),
}));
