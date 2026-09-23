import { Router } from "express";
import {
      getActiveTeamMemberBySlug,
      getActiveTeamMembers,
} from "../team-members/models/team-member.queries";
import { AppError, getStringParam, handleControllerError } from "../../utils/http";
import { pickMediaUrl, resolveMediaUrlMap } from "./public-media-url";

/**
 * Public team feed — no auth. Active members only, safe fields
 * (no Clerk IDs, no emails — team_members holds none).
 */
const router = Router();

const toPublicTeamMember = (m: Record<string, any>) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      slug: m.slug,
      roleTitle: m.roleTitle,
      bio: m.bio,
      department: m.department,
      program: m.program,
      yearSection: m.yearSection,
      profileMediaId: m.profileMediaId,
      linkedinUrl: m.linkedinUrl,
      githubUrl: m.githubUrl,
      websiteUrl: m.websiteUrl,
      isFeatured: m.isFeatured,
      displayOrder: m.displayOrder,
});

// GET /public/team?featured=true — Home carousel (is_featured, max 8–10)
router.get("/", async (req, res) => {
      try {
            const featuredOnly = req.query.featured === "true";
            const members = await getActiveTeamMembers(featuredOnly);
            const capped = featuredOnly ? members.slice(0, 10) : members;
            const urlMap = await resolveMediaUrlMap(
                  capped.map((m) => m.profileMediaId),
            );
            return res.status(200).json({
                  success: true,
                  team: capped.map((m) => ({
                        ...toPublicTeamMember(m),
                        photoUrl: pickMediaUrl(urlMap, m.profileMediaId),
                  })),
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to list public team");
      }
});

// GET /public/team/slug/:slug
router.get("/slug/:slug", async (req, res) => {
      try {
            const slug = getStringParam(req.params.slug, "slug");
            const member = await getActiveTeamMemberBySlug(slug);
            if (!member) {
                  throw new AppError(404, "Team member not found");
            }
            const urlMap = await resolveMediaUrlMap([member.profileMediaId]);
            return res.status(200).json({
                  success: true,
                  teamMember: {
                        ...toPublicTeamMember(member),
                        photoUrl: pickMediaUrl(urlMap, member.profileMediaId),
                  },
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to get public team member");
      }
});

export default router;
