import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { teamMembers } from "./models/team-member.js";
import { emptyToNull, nullableUuid } from "../../utils/zodHelpers.js";

export const TEAM_DEPARTMENTS = [
      "Executive",
      "Operations",
      "Technology",
      "Creatives",
      "Community Development",
      "Finance",
] as const;

/**
 * Legacy department alias map — mirrors the frontend theme matcher
 * (frontend/src/theme/teamTheme.js `normalizeDepartment`). CMS rows store
 * free-text ("Executive Board", "Operations Department", …); substring
 * matching folds them to the canonical enum value so legacy rows validate
 * instead of 400ing. Unknown values pass through trimmed and still fail
 * the enum check loudly.
 */
export const normalizeDepartmentName = (
      value: unknown,
): string | null | undefined => {
      if (value === undefined || value === null) return value;
      const raw = String(value).trim();
      if (raw === "") return null;
      const lower = raw.toLowerCase();
      if (lower.includes("executive")) return "Executive";
      if (lower.includes("operation")) return "Operations";
      if (lower.includes("technolog")) return "Technology";
      if (lower.includes("creative")) return "Creatives";
      if (lower.includes("community")) return "Community Development";
      if (lower.includes("financ")) return "Finance";
      return raw;
};

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
            department: z.preprocess(
                  (v) =>
                        typeof v === "string" && v.trim() === ""
                              ? null
                              : normalizeDepartmentName(v),
                  z
                        .enum(TEAM_DEPARTMENTS)
                        .nullable()
                        .optional(),
            ),
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
