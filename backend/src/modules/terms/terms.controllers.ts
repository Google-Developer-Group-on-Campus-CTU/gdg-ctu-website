import { Request, Response } from "express";
import {
      getPagination,
      handleControllerError,
      validateBody,
      validateUuid,
} from "../../utils/http.js";
import {
      createTermService,
      deleteTermService,
      getTermByIdService,
      getTermsService,
      updateTermService,
} from "./terms.services.js";
// import { CreateTermSchema, UpdateTermSchema } from "./terms.validations.js";
import { CreateTermSchema, UpdateTermSchema } from "./terms.validations.js";

export const createTerm = async (req: Request, res: Response) => {
      try {
            const data = validateBody(CreateTermSchema, req.body);
            const term = await createTermService(data);
            return res.status(201).json({ success: true, term });
      } catch (error) {
            return handleControllerError(res, error, "Failed to create term");
      }
};

export const listTerms = async (req: Request, res: Response) => {
      try {
            const pagination = getPagination(req.query);
            const { terms, pagination: meta } =
                  await getTermsService(pagination);
            return res
                  .status(200)
                  .json({ success: true, terms, pagination: meta });
      } catch (error) {
            return handleControllerError(res, error, "Failed to list terms");
      }
};

export const getTerm = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const term = await getTermByIdService(id);
            return res.status(200).json({ success: true, term });
      } catch (error) {
            return handleControllerError(res, error, "Failed to get term");
      }
};

export const updateTerm = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const data = validateBody(UpdateTermSchema, req.body);
            const term = await updateTermService(id, data);
            return res.status(200).json({ success: true, term });
      } catch (error) {
            return handleControllerError(res, error, "Failed to update term");
      }
};

export const deleteTerm = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            await deleteTermService(id);
            return res
                  .status(200)
                  .json({ success: true, message: "Term deleted" });
      } catch (error) {
            return handleControllerError(res, error, "Failed to delete term");
      }
};
