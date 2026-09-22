import { Router } from "express";
import {
      getActiveTeamMembersByTermService,
      getActiveTeamMemberBySlugService,
} from "../team-members/team-member.services";
import {
      AppError,
      getStringParam,
      handleControllerError,
} from "../../utils/http";

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
      role: m.role,
      bio: m.bio,
      department: m.department,
      program: m.program,
      yearSection: m.yearSection,
      profileMediaId: m.profileMediaId ?? m.fallbackProfileMediaId,
      secureUrl: m.profileSecureUrl,
      altText: m.profileAltText,
      termId: m.termId,
      termName: m.termName,
      linkedinUrl: m.linkedinUrl,
      githubUrl: m.githubUrl,
      websiteUrl: m.websiteUrl,
      isFeatured: m.isFeatured,
      displayOrder: m.displayOrder,
});

// GET /public/team/term?termName={{termName (e.g. 2025-2026)}} — static public feed
router.get("/term", async (req, res) => {
      try {
            // Static configuration: always show featured members only.
            const featuredOnly = true;
            // Users can select a term via the query param `termName` (e.g., ?termName=2025-2026).
            // Accept both `termName` and legacy `term` for compatibility.
            const termName =
                  typeof req.query.termName === "string" &&
                  req.query.termName.trim() !== ""
                        ? req.query.termName.trim()
                        : typeof req.query.term === "string" &&
                            req.query.term.trim() !== ""
                          ? req.query.term.trim()
                          : undefined;

            // Fetch members for the selected term, always filtering featured members.
            const members = await getActiveTeamMembersByTermService({
                  termName,
                  featuredOnly,
            });
            // No pagination or capping needed beyond the featured filter; return all.
            return res.status(200).json({
                  success: true,
                  team: members.map(toPublicTeamMember),
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to list public team",
            );
      }
});

// GET /public/team/slug/:slug
router.get("/slug/:slug", async (req, res) => {
      try {
            const slug = getStringParam(req.params.slug, "slug");
            const member = await getActiveTeamMemberBySlugService(slug);
            if (!member) {
                  throw new AppError(404, "Team member not found");
            }

            return res.status(200).json({
                  success: true,
                  teamMember: toPublicTeamMember(member),
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to get public team member",
            );
      }
});

export default router;
