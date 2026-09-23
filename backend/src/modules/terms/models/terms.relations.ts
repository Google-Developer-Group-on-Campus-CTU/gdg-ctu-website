import { relations } from "drizzle-orm";
import { terms } from "./terms.js";
import { memberTerms } from "../../member_terms/models/member-terms.js";

export const termsRelations = relations(terms, ({ many }) => ({
      memberTerms: many(memberTerms),
}));
