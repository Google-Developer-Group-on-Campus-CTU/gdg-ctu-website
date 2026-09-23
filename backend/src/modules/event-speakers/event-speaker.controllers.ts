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
import { extractMultipartPayload } from "../../utils/multiPartPayloadHelper.js";
import {
      createEventSpeakerService,
      deleteEventSpeakerService,
      getEventSpeakerByIdService,
      getEventSpeakerBySlugService,
      getEventSpeakersByTeamMemberIdService,
      getEventSpeakersService,
      updateEventSpeakerService,
} from "./event-speaker.services.js";
import {
      CreateEventSpeakerDTO,
      CreateEventSpeakerSchema,
      UpdateEventSpeakerDTO,
      UpdateEventSpeakerSchema,
} from "./event-speaker.validations.js";
import { parseOptionalEventId } from "../event-roster/event-roster.validations.js";

export const createEventSpeaker = async (req: Request, res: Response) => {
      try {
            // Multipart: `speaker` JSON + optional `file`; plain JSON body still works.
            const hasBody = Boolean(
                  req.body && Object.keys(req.body).length > 0,
            );
            if (!hasBody) {
                  throw new AppError(400, "'speaker' payload missing");
            }

            const payload = extractMultipartPayload(req.body, "speaker", [
                  "uploadedBy",
            ]);
            const data: CreateEventSpeakerDTO = validateBody(
                  CreateEventSpeakerSchema,
                  payload,
            );

            const file = (req as any).file?.buffer as Buffer | undefined;
            const eventSpeaker = await createEventSpeakerService(data, {
                  file,
                  uploadedBy: getUserIdFromRequest(req),
            });

            return res.status(201).json({
                  success: true,
                  message: "Event speaker created successfully",
                  eventSpeaker,
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to create event speaker",
            );
      }
};

export const listEventSpeakers = async (req: Request, res: Response) => {
      try {
            const paginationQuery = getPagination(req.query);
            const eventId = parseOptionalEventId(req.query);
            const { eventSpeakers, pagination } =
                  await getEventSpeakersService(paginationQuery, eventId);

            return res.status(200).json({
                  success: true,
                  eventSpeakers,
                  pagination,
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to list event speakers",
            );
      }
};

export const getEventSpeaker = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const eventSpeaker = await getEventSpeakerByIdService(id);

            return res.status(200).json({
                  success: true,
                  eventSpeaker,
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to get event speaker",
            );
      }
};

export const getEventSpeakerBySlug = async (
      req: Request,
      res: Response,
) => {
      try {
            const slug = getStringParam(req.params.slug, "slug");
            const eventSpeaker = await getEventSpeakerBySlugService(slug);

            return res.status(200).json({
                  success: true,
                  eventSpeaker,
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to get event speaker",
            );
      }
};

export const listEventSpeakersForTeamMember = async (
      req: Request,
      res: Response,
) => {
      try {
            const teamMemberId = validateUuid(
                  req.params.teamMemberId,
                  "teamMemberId",
            );
            const paginationQuery = getPagination(req.query);
            const { eventSpeakers, pagination } =
                  await getEventSpeakersByTeamMemberIdService(
                        teamMemberId,
                        paginationQuery,
                  );

            return res.status(200).json({
                  success: true,
                  eventSpeakers,
                  pagination,
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to list team member event speakers",
            );
      }
};

export const updateEventSpeaker = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const file = (req as any).file?.buffer as Buffer | undefined;

            // Body is optional when a replacement profile file is supplied.
            // `uploadedBy` is an auth fallback, not a DTO field — ignore it here.
            const bodyFields: Record<string, unknown> = {
                  ...(req.body ?? {}),
            };
            delete bodyFields.uploadedBy;
            const hasBody = Object.keys(bodyFields).length > 0;
            let data: UpdateEventSpeakerDTO = {} as UpdateEventSpeakerDTO;
            if (hasBody) {
                  const payload = extractMultipartPayload(req.body, "speaker", [
                        "uploadedBy",
                  ]);
                  data = validateBody(UpdateEventSpeakerSchema, payload);
            }

            if (!hasBody && !file) {
                  throw new AppError(
                        400,
                        "At least one field or file is required",
                  );
            }

            const eventSpeaker = await updateEventSpeakerService(id, data, {
                  file,
                  uploadedBy: getUserIdFromRequest(req),
            });

            return res.status(200).json({
                  success: true,
                  message: "Event speaker updated successfully",
                  eventSpeaker,
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to update event speaker",
            );
      }
};

export const removeEventSpeaker = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            await deleteEventSpeakerService(id);

            return res.status(200).json({
                  success: true,
                  message: "Event speaker deleted successfully",
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to delete event speaker",
            );
      }
};
