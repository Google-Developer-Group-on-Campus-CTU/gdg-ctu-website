import { Request, Response } from "express";
import {
      getPagination,
      handleControllerError,
      validateBody,
      validateUuid,
} from "../../utils/http.js";
import {
      createMemberTermService,
      getMemberTermsService,
      getMemberTermByIdService,
      updateMemberTermService,
      deleteMemberTermService,
} from "./member-terms.services.js";
import {
      CreateMemberTermsSchema,
      UpdateMemberTermSchema,
} from "./member-terms.validations.js";

export const createMemberTerm = async (req: Request, res: Response) => {
      try {
            const data = validateBody(CreateMemberTermsSchema, req.body);
            const memberTerm = await createMemberTermService(data);
            return res.status(201).json({ success: true, memberTerm });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to create member term",
            );
      }
};

export const listMemberTerms = async (req: Request, res: Response) => {
      try {
            const pagination = getPagination(req.query);
            const { memberTerms, pagination: meta } =
                  await getMemberTermsService(pagination);
            return res
                  .status(200)
                  .json({ success: true, memberTerms, pagination: meta });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to list member terms",
            );
      }
};

export const getMemberTerm = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const memberTerm = await getMemberTermByIdService(id);
            return res.status(200).json({ success: true, memberTerm });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to get member term",
            );
      }
};

export const updateMemberTerm = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const data = validateBody(UpdateMemberTermSchema, req.body);
            const memberTerm = await updateMemberTermService(id, data);
            return res.status(200).json({ success: true, memberTerm });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to update member term",
            );
      }
};

export const deleteMemberTerm = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            await deleteMemberTermService(id);
            return res
                  .status(200)
                  .json({ success: true, message: "Member term deleted" });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to delete member term",
            );
      }
};
