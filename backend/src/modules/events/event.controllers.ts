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
      createEventService,
      deleteEventService,
      getEventByIdService,
      getEventBySlugService,
      getEventsService,
      updateEventService,
} from "./event.services.js";
import { CreateEventSchema, UpdateEventSchema } from "./event.validations.js";
import {
      extractMultipartPayload,
      parseJsonField,
} from "../../utils/multiPartPayloadHelper.js";

export const createEvent = async (req: Request, res: Response) => {
      try {
            const file = (req as any).file?.buffer;
            if (!file) {
                  throw new AppError(400, "Event cover image is required");
            }

            // Session is guaranteed by requireAuth on the protected /events
            // mount — no per-controller 401 here. A missing user still fails
            // closed with one message: CreateEventSchema requires createdBy
            // and createEventService throws 401 "Admin ID missing".
            const userId = getUserIdFromRequest(req);

            const eventJson = req.body.event;
            if (!eventJson) {
                  throw new AppError(400, "'event' JSON payload missing");
            }

            const rawEventData = parseJsonField(eventJson, "event");
            rawEventData.createdBy = userId;

            const eventData = CreateEventSchema.parse(rawEventData);

            const event = await createEventService({
                  eventData,
                  file: file,
                  uploadedBy: userId,
            });

            return res.status(201).json({
                  success: true,
                  message: "Event created successfully",
                  event,
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to create event");
      }
};

export const listEvents = async (req: Request, res: Response) => {
      try {
            const userId = getUserIdFromRequest(req);
            if (!userId) {
                  throw new AppError(401, "Unauthorized: user ID missing");
            }

            const paginationQuery = getPagination(req.query);
            const { events, pagination } =
                  await getEventsService(paginationQuery);

            return res.status(200).json({
                  success: true,
                  events,
                  pagination,
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to list events");
      }
};

export const getEvent = async (req: Request, res: Response) => {
      try {
            const userId = getUserIdFromRequest(req);
            if (!userId) {
                  throw new AppError(401, "Unauthorized: user ID missing");
            }

            const id = validateUuid(req.params.id);
            const event = await getEventByIdService(id);

            return res.status(200).json({
                  success: true,
                  event,
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to get event");
      }
};

export const getEventBySlug = async (req: Request, res: Response) => {
      try {
            const userId = getUserIdFromRequest(req);
            if (!userId) {
                  throw new AppError(401, "Unauthorized: user ID missing");
            }

            const slug = getStringParam(req.params.slug, "slug");
            if (!slug) {
                  throw new AppError(404, "Slug missing");
            }
            const event = await getEventBySlugService(slug);

            return res.status(200).json({
                  success: true,
                  event,
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to get event");
      }
};

export const updateEvent = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const file = (req as any).file?.buffer; // No file validation since media is optional upon update

            const eventPayload = extractMultipartPayload(req.body, "event", [
                  "uploadedBy",
            ]);
            const eventData = validateBody(UpdateEventSchema, eventPayload);

            const userId = getUserIdFromRequest(req);
            if (file && !userId) {
                  throw new AppError(
                        401,
                        "Unauthorized: missing user ID, cannot proceed",
                  );
            }

            const updatedEvent = await updateEventService({
                  id,
                  event: eventData,
                  file: file,
                  uploadedBy: userId,
            });

            return res.status(200).json({
                  success: true,
                  message: "Event updated successfully",
                  event: updatedEvent,
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to update event");
      }
};

export const removeEvent = async (req: Request, res: Response) => {
      try {
            const userId = getUserIdFromRequest(req);
            if (!userId) {
                  throw new AppError(401, "Unauthorized: user ID missing");
            }

            const id = validateUuid(req.params.id);
            await deleteEventService(id);

            return res.status(200).json({
                  success: true,
                  message: "Event deleted successfully",
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to delete event");
      }
};
