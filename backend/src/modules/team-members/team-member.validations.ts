import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { teamMembers } from "./models/team-member.js";
import { emptyToNull, nullableUuid } from "../../utils/zodHelpers.js";

export const TeamMemberSchema = createSelectSchema(teamMembers);
export const CreateTeamMemberSchema = createInsertSchema(teamMembers)
      .omit({
            id: true,
            createdAt: true,
            updatedAt: true,
      })
      .extend({
            firstName: z
                  .string()
                  .trim()
                  .min(1, { message: "First name is required." }),
            lastName: z
                  .string()
                  .trim()
                  .min(1, { message: "Last name is required." }),
            slug: z.string().trim().min(1, { message: "Slug is required." }),
            bio: z.string().nullable().optional(),
            department: z.string().trim().nullable().optional(),
            program: z.string().trim().nullable().optional(),
            yearSection: z.string().trim().nullable().optional(),
            linkedinUrl: emptyToNull(
                  z
                        .url()
                        .nullable()
                        .optional(),
            ).refine((val) => !val || val.length > 0, {
                  message: "LinkedIn URL must be a valid URL if provided.",
            }),
            githubUrl: emptyToNull(
                  z
                        .url()
                        .nullable()
                        .optional(),
            ).refine((val) => !val || val.length > 0, {
                  message: "GitHub URL must be a valid URL if provided.",
            }),
            websiteUrl: emptyToNull(
                  z
                        .url()
                        .nullable()
                        .optional(),
            ).refine((val) => !val || val.length > 0, {
                  message: "Website URL must be a valid URL if provided.",
            }),
            profileMediaId: nullableUuid(
                  "Profile media ID must be a valid UUID if provided.",
            ),
            displayOrder: z.number().int().nonnegative().optional(),
            isFeatured: z.boolean().optional(),
            isActive: z.boolean().optional(),
      });

export const UpdateTeamMemberSchema = CreateTeamMemberSchema.partial().refine(
      (data) => Object.keys(data).length > 0,
      "At least one field is required",
);

export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type CreateTeamMemberDTO = z.infer<typeof CreateTeamMemberSchema>;
export type UpdateTeamMemberDTO = z.infer<typeof UpdateTeamMemberSchema>;
