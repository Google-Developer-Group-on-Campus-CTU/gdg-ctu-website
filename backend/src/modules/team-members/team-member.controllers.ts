import { Request, Response } from "express";
import { getUserIdFromRequest } from "../auth/auth.utils.js";
import {
      AppError,
      getPagination,
      getStringParam,
      handleControllerError,
      validateBody,
      validateUuid,
} from "../../utils/http.js";
import {
      createTeamMemberService,
      deleteTeamMemberService,
      getTeamMemberByIdService,
      getTeamMemberBySlugService,
      getTeamMembersService,
      getActiveTeamMembersByTermService,
      updateTeamMemberService,
} from "./team-member.services.js";
import {
      CreateTeamMemberSchema,
      normalizeDepartmentName,
      UpdateTeamMemberDTO,
      UpdateTeamMemberSchema,
} from "./team-member.validations.js";
import { parseJsonField } from "../../utils/multiPartPayloadHelper.js";
import logger from "../../utils/logger.js";

export const createTeamMemberWithImage = async (
      req: Request,
      res: Response,
) => {
      try {
            // File is optional: when present its buffer is uploaded and
            // becomes the profile photo; otherwise `profileMediaId` /
            // `photoMediaId` from the body (MediaPicker-selected media) is
            // used.
            const file = (req as any).file?.buffer as Buffer | undefined;

            // Accept both contracts:
            // (a) multipart with a JSON-string `member` field, or
            // (b) flat JSON body with the member fields directly.
            const hasMemberWrapper =
                  req.body?.member !== undefined &&
                  req.body.member !== null &&
                  req.body.member !== "";
            let rawMemberData: Record<string, unknown>;
            if (hasMemberWrapper) {
                  rawMemberData =
                        typeof req.body.member === "string"
                              ? parseJsonField(req.body.member, "member")
                              : {
                                      ...(req.body.member as Record<
                                            string,
                                            unknown
                                      >),
                                };
            } else {
                  rawMemberData = { ...req.body };
                  delete rawMemberData.file;
            }

            // `photoMediaId` is the flat-JSON alias for the
            // `profileMediaId` column — fold it before Zod.
            if (
                  rawMemberData.profileMediaId == null &&
                  rawMemberData.photoMediaId != null
            ) {
                  rawMemberData.profileMediaId = rawMemberData.photoMediaId;
            }
            delete rawMemberData.photoMediaId;

            // termId / role may arrive top-level (multipart fields) or
            // nested inside the member payload (flat JSON).
            const rawTermId =
                  req.body?.termId ?? rawMemberData.termId ?? rawMemberData.term_id;
            const rawRole =
                  req.body?.role ??
                  (rawMemberData.role as unknown) ??
                  (rawMemberData as Record<string, unknown>).roleTitle ??
                  (rawMemberData as Record<string, unknown>).role_title;
            const termId =
                  typeof rawTermId === "string" && rawTermId.trim() !== ""
                        ? rawTermId.trim()
                        : typeof rawTermId === "number"
                              ? String(rawTermId)
                              : undefined;
            const role =
                  typeof rawRole === "string" && rawRole.trim() !== ""
                        ? rawRole.trim()
                        : undefined;
            delete rawMemberData.termId;
            delete rawMemberData.term_id;
            // `role`/`roleTitle` is term-assignment data, not a team_members column.
            delete rawMemberData.role;
            delete rawMemberData.roleTitle;
            delete rawMemberData.role_title;
            // Legacy display keys are not columns either.
            delete rawMemberData.status;
            delete rawMemberData.profileAlt;
            delete rawMemberData.profile_alt;

            const memberData = validateBody(
                  CreateTeamMemberSchema,
                  normalizeTeamMemberAliases(
                        rawMemberData as Record<string, unknown>,
                  ),
            );

            if (!termId) {
                  throw new AppError(400, "termId missing");
            }

            if (!role) {
                  throw new AppError(
                        400,
                        "Cannot Proceed: Member Role is missing",
                  );
            }

            const userId = getUserIdFromRequest(req);
            if (!userId) {
                  throw new AppError(401, "Unauthorized: missing user ID");
            }

            const teamMember = await createTeamMemberService(
                  {
                        memberData,
                        file: file,
                        uploadedBy: userId,
                  },
                  {
                        termId,
                        role,
                  },
            );

            return res.status(201).json({
                  success: true,
                  message: "Team member with profile image created",
                  teamMember,
            });
      } catch (error: any) {
            logger.error("Failed to create team member with image", {
                  message: error.message,
                  stack: error.stack,
            });
            return handleControllerError(
                  res,
                  error,
                  "Failed to create team member with image",
            );
      }
};

export const listTeamMembers = async (req: Request, res: Response) => {
      try {
            const paginationQuery = getPagination(req.query);
            const { teamMembers, pagination } =
                  await getTeamMembersService(paginationQuery);
            return res
                  .status(200)
                  .json({ success: true, teamMembers, pagination });
      } catch (error: any) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to list team members",
            );
      }
};

export const getTeamMember = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const teamMember = await getTeamMemberByIdService(id);
            return res.status(200).json({ success: true, teamMember });
      } catch (error: any) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to get team member",
            );
      }
};

export const getTeamMemberBySlug = async (req: Request, res: Response) => {
      try {
            const slug = getStringParam(req.params.slug, "slug");
            const teamMember = await getTeamMemberBySlugService(slug);
            return res.status(200).json({ success: true, teamMember });
      } catch (error: any) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to get team member",
            );
      }
};

export const listTeamMembersByTerm = async (req: Request, res: Response) => {
      try {
            const termId = validateUuid(req.params.termId, "termId");
            // Filters
            const termName = getStringParam(req.params.termName, "termName");
            const currentOnly = req.body.currentOnly;
            const featuredOnly = req.body.featuredOnly;

            const teamMembers = await getActiveTeamMembersByTermService({
                  termId,
                  termName,
                  currentOnly,
                  featuredOnly,
            });
            return res.status(200).json({
                  success: true,
                  count: teamMembers.length,
                  message: `Successfully listed team members for term ${termId}`,
                  teamMembers,
            });
      } catch (error: any) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to list team members by term",
            );
      }
};

/**
 * Fold legacy snake_case / drift aliases into the camelCase admin contract
 * (firstName, lastName, slug, bio, department, program, yearSection,
 * profileMediaId, linkedinUrl/githubUrl/websiteUrl, isFeatured,
 * displayOrder, isActive). Department free-text ("Executive Board",
 * "Operations Department", …) is folded to the canonical enum via
 * normalizeDepartmentName so legacy rows don't 400. Unknown keys (e.g.
 * roleTitle/status/profileAlt) are dropped — role lives on member_terms,
 * status/profileAlt are not team_members columns.
 */
const normalizeTeamMemberAliases = (
      raw: Record<string, unknown>,
): Record<string, unknown> => {
      const get = (...keys: string[]) => {
            for (const k of keys) {
                  const v = raw[k];
                  if (v !== undefined) return v;
            }
            return undefined;
      };
      const emptyToUndefined = (v: unknown) =>
            v === "" ? undefined : v;
      const out: Record<string, unknown> = {};
      const assign = (key: string, value: unknown) => {
            const v = emptyToUndefined(value);
            if (v !== undefined) out[key] = v;
      };
      assign("firstName", get("firstName", "first_name"));
      assign("lastName", get("lastName", "last_name"));
      assign("slug", get("slug"));
      assign("bio", get("bio"));
      assign(
            "department",
            normalizeDepartmentName(get("department")),
      );
      assign("program", get("program"));
      assign("yearSection", get("yearSection", "year_section"));
      assign("profileMediaId", get("profileMediaId", "profile_media_id"));
      assign("linkedinUrl", get("linkedinUrl", "linkedin_url"));
      assign("githubUrl", get("githubUrl", "github_url"));
      assign("websiteUrl", get("websiteUrl", "website_url"));
      assign("isFeatured", get("isFeatured", "is_featured"));
      assign("displayOrder", get("displayOrder", "display_order"));
      assign("isActive", get("isActive", "is_active"));
      return out;
};

export const updateTeamMember = async (req: Request, res: Response) => {
      try {
            const memberId = validateUuid(req.params.id);

            // Optional new profile image
            const file = (req as any).file?.buffer;

            // Optional term association (top-level or nested in member wrapper)
            const rawTermId =
                  req.body?.termId ??
                  req.body?.member?.termId ??
                  req.body?.term_id;
            const rawRole = req.body?.role ?? req.body?.member?.role;
            const termId =
                  typeof rawTermId === "string" &&
                  rawTermId.trim() !== ""
                        ? rawTermId.trim()
                        : undefined;

            const role =
                  typeof rawRole === "string" &&
                  rawRole.trim() !== ""
                        ? rawRole.trim()
                        : undefined;

            // Optional member JSON payload (non‑media fields). Accepts both:
            // (a) a `member` wrapper object / JSON string, or
            // (b) flat JSON identity fields directly in the body (the admin
            // form contract — camelCase aligned to CreateTeamMemberSchema).
            const memberJson = req.body.member;
            let memberData: UpdateTeamMemberDTO | undefined;
            if (memberJson) {
                  const parsed =
                        typeof memberJson === "string"
                              ? parseJsonField(memberJson, "member")
                              : { ...(memberJson as Record<string, unknown>) };
                  delete (parsed as Record<string, unknown>).termId;
                  delete (parsed as Record<string, unknown>).term_id;
                  delete (parsed as Record<string, unknown>).role;
                  memberData = validateBody(
                        UpdateTeamMemberSchema,
                        normalizeTeamMemberAliases(parsed),
                  );
            } else {
                  const {
                        termId: _t,
                        term_id: _t2,
                        role: _r,
                        file: _f,
                        photoMediaId: _p,
                        ...flat
                  } = { ...(req.body ?? {}) } as Record<string, unknown>;
                  // Fold the flat-JSON photo alias before validation.
                  if (
                        flat.profileMediaId == null &&
                        _p != null
                  ) {
                        flat.profileMediaId = _p;
                  }
                  const normalized = normalizeTeamMemberAliases(flat);
                  const hasFields = Object.keys(normalized).some(
                        (k) =>
                              normalized[k] !== undefined &&
                              normalized[k] !== "",
                  );
                  if (hasFields || file) {
                        memberData = hasFields
                              ? validateBody(
                                      UpdateTeamMemberSchema,
                                      normalized,
                                )
                              : undefined;
                  }
            }

            const userId = getUserIdFromRequest(req);
            if (!userId) {
                  throw new AppError(401, "Unauthorized: missing user ID");
            }

            const updated = await updateTeamMemberService(
                  {
                        id: memberId,
                        memberData,
                        file,
                        uploadedBy: userId,
                  },
                  termId && role ? { termId, role } : undefined,
            );

            return res.status(200).json({
                  success: true,
                  message: "Team member updated successfully",
                  teamMember: updated,
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to update team member",
            );
      }
};

export const removeTeamMember = async (req: Request, res: Response) => {
      try {
            const memberId = validateUuid(req.params.id);

            await deleteTeamMemberService(memberId);
            return res.status(200).json({
                  success: true,
                  message: "Team member deleted successfully",
            });
      } catch (error: any) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to delete team member",
            );
      }
};
