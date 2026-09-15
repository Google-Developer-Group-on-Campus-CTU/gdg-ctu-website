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
import { UpdateTeamMemberSchema } from "./team-member.validations";
import { NewTeamMemberRecord } from "./models/team-member.queries";
import { extractMultipartPayload } from "../../utils/multiPartPayloadHelper";
import logger from "../../utils/logger";

export const createTeamMemberWithImage = async (
      req: Request,
      res: Response,
) => {
      try {
            const file = (req as any).file?.buffer;
            if (!file) {
                  return res.status(400).json({
                        success: false,
                        message: "Profile image is required",
                  });
            }

            const memberJson = req.body.member;
            if (!memberJson) {
                  throw new AppError(400, "`member` JSON payload missing");
            }
            const memberData: NewTeamMemberRecord = JSON.parse(memberJson);

            if (!req.body.termId) {
                  throw new AppError(400, "termId missing");
            }
            const termId = String(req.body.termId);

            if (!req.body.role) {
                  throw new AppError(
                        400,
                        "Cannot Proceed: Member Role is missing",
                  );
            }
            const role = String(req.body.role);

            const clerkId = getClerkIdFromRequest(req);
            if (!clerkId) {
                  return res.status(401).json({
                        success: false,
                        message: "Unable to determine uploader (Clerk ID)",
                  });
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
            const id = validateUuid(req.params.id);
            const file = (req as any).file?.buffer;

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

            const memberPayload = extractMultipartPayload(req.body, "member", [
                  "uploadedBy",
            ]);
            const memberData = validateBody(
                  UpdateTeamMemberSchema,
                  memberPayload,
            );

            const clerkId = getClerkIdFromRequest(req);
            if (!clerkId) {
                  return res.status(401).json({
                        success: false,
                        message: "Unable to determine uploader (Clerk ID)",
                  });
            }

            const updated = await updateTeamMemberService(
                  {
                        id,
                        memberData,
                        file,
                        uploadedBy: clerkId,
                  },
                  termId && role
                        ? {
                                termId,
                                role,
                          }
                        : undefined,
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
            const id = validateUuid(req.params.id);
            await deleteTeamMemberService(id);
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
