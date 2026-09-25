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
            const rawRole = req.body?.role ?? rawMemberData.role;
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
            // `role` is term-assignment data, not a team_members column.
            delete rawMemberData.role;

            const memberData = validateBody(
                  CreateTeamMemberSchema,
                  rawMemberData,
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

export const updateTeamMember = async (req: Request, res: Response) => {
      try {
            const memberId = validateUuid(req.params.id);

            // Optional new profile image
            const file = (req as any).file?.buffer;

            // Optional term association
            const termId =
                  typeof req.body.termId === "string" &&
                  req.body.termId.trim() !== ""
                        ? req.body.termId.trim()
                        : undefined;

            const role =
                  typeof req.body.role === "string" &&
                  req.body.role.trim() !== ""
                        ? req.body.role.trim()
                        : undefined;

            // Optional member JSON payload (non‑media fields)
            const memberJson = req.body.member;
            let memberData: UpdateTeamMemberDTO | undefined;
            if (memberJson) {
                  memberData = validateBody(
                        UpdateTeamMemberSchema,
                        parseJsonField(memberJson, "member"),
                  );
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
