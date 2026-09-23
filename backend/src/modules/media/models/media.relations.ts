import { relations } from "drizzle-orm";
import { user } from "../../auth/models/auth.js";
import { eventSpeakers } from "../../event-speakers/models/event-speaker.js";
import { events } from "../../events/models/event.js";
import { memberTerms } from "../../member_terms/models/member-terms.js";
import { siteContent } from "../../site-content/models/site-content.js";
import { teamMembers } from "../../team-members/models/team-member.js";
import { media } from "./media.js";

export const mediaRelations = relations(media, ({ one, many }) => ({
      uploader: one(user, {
            fields: [media.uploadedBy],
            references: [user.id],
      }),
      teamMembers: many(teamMembers),
      memberTerms: many(memberTerms),
      eventSpeakers: many(eventSpeakers),
      events: many(events),
      siteContent: many(siteContent),
}));
