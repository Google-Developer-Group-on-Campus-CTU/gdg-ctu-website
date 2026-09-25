import { Router } from "express";
import {
      getActiveTeamMembersByTermService,
      getActiveTeamMemberBySlugService,
} from "../team-members/team-member.services.js";
import { getCurrentTerm } from "../terms/models/terms.queries.js";
import {
      AppError,
      getStringParam,
      handleControllerError,
} from "../../utils/http.js";
import { pickMediaUrl, resolveMediaUrlMap } from "./public-media-url.js";

/**
 * Public team feed — no auth. Active members only, safe fields
 * (no Clerk IDs, no emails — team_members holds none).
 *
 * Term scoping: an explicit `termName` (or legacy `term`) wins; otherwise
 * the feed defaults to the current (`isCurrent`) term. When no current
 * term exists the feed returns an empty roster — never an all-terms dump.
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

/**
 * Resolve the roster filter: explicit termName wins; otherwise fall back
 * to the current term. Returns `null` when no current term exists so
 * callers can return an empty roster instead of an all-terms dump.
 */
const resolveTermFilter = async (
      query: Record<string, any>,
): Promise<{ termName: string } | { currentOnly: true } | null> => {
      const termName = parseTermName(query);
      if (termName) return { termName };
      const current = await getCurrentTerm();
      if (!current) return null;
      return { currentOnly: true as const };
};

// GET /public/team/term?termName={{termName (e.g. 2025-2026)}} — static public feed
router.get("/term", async (req, res) => {
      try {
            // Static configuration: always show featured members only.
            const featuredOnly = true;
            const termFilter = await resolveTermFilter(req.query);
            if (!termFilter) {
                  return res.status(200).json({ success: true, team: [] });
            }

            // Fetch members for the selected term, always filtering featured members.
            const members = await getActiveTeamMembersByTermService({
                  ...termFilter,
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
            const termFilter = await resolveTermFilter(req.query);
            if (!termFilter) {
                  return res.status(200).json({ success: true, team: [] });
            }
            const members = await getActiveTeamMembersByTermService({
                  ...termFilter,
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
