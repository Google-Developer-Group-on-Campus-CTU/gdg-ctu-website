import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { memberTerms } from "./models/member-terms";

export const MemberTermsSchema = createSelectSchema(memberTerms);
export const CreateMemberTermsSchema = createInsertSchema(memberTerms)
      .omit({
            id: true,
            createdAt: true,
            updatedAt: true,
      })
      .extend({
            memberId: z.uuid({
                  message: "Member ID must be a valid UUID.",
            }),
            termId: z.uuid({
                  message: "Term ID must be a valid UUID.",
            }),
            role: z.string({
                  message: "Role is required.",
            }),
            profileMediaId: z
                  .uuid({
                        message: "Profile media ID must be a valid UUID.",
                  })
                  .nullable()
                  .optional(),
            displayOrder: z.number().int().nonnegative().optional(),
            isActive: z.boolean().optional(),
      });

export const UpdateMemberTermSchema = CreateMemberTermsSchema.partial().refine(
      (data) => Object.keys(data).length > 0,
      "At least one field is required",
);

/**
 * Used when assigning/updating a team member's term.
 * The memberId comes from the route/service, so it is not accepted here.
 */
export const UpdateTeamMemberTermSchema = CreateMemberTermsSchema.pick({
      termId: true,
      role: true,
});

export type MemberTerms = z.infer<typeof MemberTermsSchema>;
export type CreateMemberTermsDTO = z.infer<typeof CreateMemberTermsSchema>;
export type UpdateMemberTermDTO = z.infer<typeof UpdateMemberTermSchema>;
export type UpdateTeamMemberTermDTO = z.infer<
      typeof UpdateTeamMemberTermSchema
>;
