import { Request, Response } from "express";
import { getClerkIdFromRequest } from "../auth/auth.utils";
import {
      AppError,
      getPagination,
      getStringParam,
      handleControllerError,
      validateBody,
      validateUuid,
} from "../../utils/http";
import {
      createTeamMemberService,
      deleteTeamMemberService,
      getTeamMemberByIdService,
      getTeamMemberBySlugService,
      getTeamMembersService,
      updateTeamMemberService,
} from "./team-member.services";
import { UpdateTeamMemberDTO } from "./team-member.validations";
import { NewTeamMemberRecord } from "./models/team-member.queries";
import logger from "../../utils/logger";

export const createTeamMemberWithImage = async (
      req: Request,
      res: Response,
) => {
      try {
            const file = (req as any).file?.buffer;
            if (!file) {
                  throw new AppError(400, "Profile image is required");
            }

            const memberJson = req.body.member;
            if (!memberJson) {
                  throw new AppError(400, "`member` JSON payload missing");
            }
            const memberData: NewTeamMemberRecord = JSON.parse(memberJson);

            const termId = String(req.body.termId);
            if (!req.body.termId) {
                  throw new AppError(400, "termId missing");
            }

            const role = String(req.body.role);
            if (!req.body.role) {
                  throw new AppError(
                        400,
                        "Cannot Proceed: Member Role is missing",
                  );
            }

            const clerkId = getClerkIdFromRequest(req);
            if (!clerkId) {
                  throw new AppError(401, "Unauthorized: missing clerkId");
            }

            const teamMember = await createTeamMemberService(
                  {
                        memberData,
                        file: file,
                        uploadedBy: clerkId,
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

export const updateTeamMember = async (req: Request, res: Response) => {
      try {
            const memberId = validateUuid(req.params.id);
            if (!memberId) {
                  throw new AppError(401, "Member ID missing");
            }

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
                  memberData = JSON.parse(memberJson) as UpdateTeamMemberDTO;
            }

            const clerkId = getClerkIdFromRequest(req);
            if (!clerkId) {
                  throw new AppError(401, "Unauthorized: missing clerkID");
            }

            const updated = await updateTeamMemberService(
                  {
                        id: memberId,
                        memberData,
                        file,
                        uploadedBy: clerkId,
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
            if (!memberId) {
                  throw new AppError(404, "Missing member ID");
            }

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
