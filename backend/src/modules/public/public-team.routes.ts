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

/**
 * Attach the resolved Cloudinary `photoUrl` alongside the stored FK columns.
 * The join key mirrors the mapper's `profileMediaId ?? fallbackProfileMediaId`
 * fallback so term snapshots without their own avatar still resolve.
 */
const withPhotoUrls = async (members: Record<string, any>[]) => {
      const mapped = members.map(toPublicTeamMember);
      const urlMap = await resolveMediaUrlMap(
            mapped.map((m) => m.profileMediaId),
      );
      return mapped.map((m) => ({
            ...m,
            photoUrl: pickMediaUrl(urlMap, m.profileMediaId),
      }));
};

const parseTermName = (query: Record<string, any>): string | undefined => {
      // Accept both `termName` and legacy `term` for compatibility.
      if (typeof query.termName === "string" && query.termName.trim() !== "") {
            return query.termName.trim();
      }
      if (typeof query.term === "string" && query.term.trim() !== "") {
            return query.term.trim();
      }
      return undefined;
};

// GET /public/team/term?termName={{termName (e.g. 2025-2026)}} — static public feed
router.get("/term", async (req, res) => {
      try {
            // Static configuration: always show featured members only.
            const featuredOnly = true;
            // Users can select a term via the query param `termName` (e.g., ?termName=2025-2026).
            const termName = parseTermName(req.query);

            // Fetch members for the selected term, always filtering featured members.
            const members = await getActiveTeamMembersByTermService({
                  termName,
                  featuredOnly,
            });
            // No pagination or capping needed beyond the featured filter; return all.
            return res.status(200).json({
                  success: true,
                  team: await withPhotoUrls(members),
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to list public team",
            );
      }
});

// GET /public/team?featured=true&termName=2025-2026 — Home carousel / Officers roster
router.get("/", async (req, res) => {
      try {
            const featuredOnly = req.query.featured === "true";
            const termName = parseTermName(req.query);
            const members = await getActiveTeamMembersByTermService({
                  termName,
                  featuredOnly,
            });
            const capped = featuredOnly ? members.slice(0, 10) : members;
            return res.status(200).json({
                  success: true,
                  team: await withPhotoUrls(capped),
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

            const [resolved] = await withPhotoUrls([member]);
            return res.status(200).json({
                  success: true,
                  teamMember: resolved,
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
