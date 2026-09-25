import { Request, Response } from "express";
import {
      getPagination,
      handleControllerError,
      validateBody,
      validateUuid,
} from "../../utils/http.js";
import {
      createContactMessageService,
      deleteContactMessageService,
      getContactMessageByIdService,
      getContactMessagesService,
      updateContactMessageService,
} from "./contact-messages.services.js";
import {
      SubmitContactMessageSchema,
      UpdateContactMessageSchema,
} from "./contact-messages.validations.js";

export const submitContactMessage = async (req: Request, res: Response) => {
      try {
            const data = validateBody(SubmitContactMessageSchema, req.body);
            const item = await createContactMessageService(data);
            return res.status(201).json({
                  success: true,
                  message: "Contact message submitted successfully",
                  item,
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to submit contact message",
            );
      }
};

export const listContactMessages = async (req: Request, res: Response) => {
      try {
            const paginationQuery = getPagination(req.query);
            const { items, pagination } =
                  await getContactMessagesService(paginationQuery);
            return res.status(200).json({ success: true, items, pagination });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to list contact messages",
            );
      }
};

export const getContactMessage = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const item = await getContactMessageByIdService(id);
            return res.status(200).json({ success: true, item });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to get contact message",
            );
      }
};

export const updateContactMessage = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const data = validateBody(UpdateContactMessageSchema, req.body);
            const item = await updateContactMessageService(id, data);
            return res.status(200).json({
                  success: true,
                  message: "Contact message updated successfully",
                  item,
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to update contact message",
            );
      }
};

export const removeContactMessage = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            await deleteContactMessageService(id);
            return res.status(200).json({
                  success: true,
                  message: "Contact message deleted successfully",
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to delete contact message",
            );
      }
};
