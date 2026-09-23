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
      createEventService,
      deleteEventService,
      getEventByIdService,
      getEventBySlugService,
      getEventsService,
      updateEventService,
} from "./event.services";
import { CreateEventSchema, UpdateEventSchema } from "./event.validations";
import { extractMultipartPayload } from "../../utils/multiPartPayloadHelper";

export const createEvent = async (req: Request, res: Response) => {
      try {
            const file = (req as any).file?.buffer;
            if (!file) {
                  throw new AppError(400, "Event cover image is required");
            }

            const clerkId = getClerkIdFromRequest(req);
            if (file && !clerkId) {
                  throw new AppError(
                        401,
                        "Unable to determine uploader (Clerk ID) for image upload",
                  );
            }

            const eventJson = req.body.event;
            if (!eventJson) {
                  throw new AppError(400, "'event' JSON payload missing");
            }

            const rawEventData = JSON.parse(eventJson);
            rawEventData.createdBy = clerkId;

            const eventData = CreateEventSchema.parse(rawEventData);

            const event = await createEventService({
                  eventData,
                  file: file,
                  uploadedBy: clerkId,
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
            const clerkId = getClerkIdFromRequest(req);
            if (!clerkId) {
                  throw new AppError(401, "Unauthorized: ClerkId missing");
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
            const clerkId = getClerkIdFromRequest(req);
            if (!clerkId) {
                  throw new AppError(401, "Unauthorized: ClerkId missing");
            }

            const id = validateUuid(req.params.id);
            if (!id) {
                  throw new AppError(404, "Event ID missing");
            }
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
            const clerkId = getClerkIdFromRequest(req);
            if (!clerkId) {
                  throw new AppError(401, "Unauthorized: ClerkId missing");
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
            if (!id) {
                  throw new AppError(404, "Event ID missing, cannot proceed");
            }
            const file = (req as any).file?.buffer; // No file validation since media is optional upon update

            const eventPayload = extractMultipartPayload(req.body, "event", [
                  "uploadedBy",
            ]);
            const eventData = validateBody(UpdateEventSchema, eventPayload);

            const clerkId = getClerkIdFromRequest(req);
            if (file && !clerkId) {
                  throw new AppError(
                        401,
                        "Unauthorized, missing clerkId, cannot proceed",
                  );
            }

            const updatedEvent = await updateEventService({
                  id,
                  event: eventData,
                  file: file,
                  uploadedBy: clerkId,
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
            const clerkId = getClerkIdFromRequest(req);
            if (!clerkId) {
                  throw new AppError(401, "Unauthorized: ClerkId missing");
            }

            const id = validateUuid(req.params.id);
            if (!id) {
                  throw new AppError(
                        404,
                        "Event ID to delete missing, cannot proceed",
                  );
            }
            await deleteEventService(id);

            return res.status(200).json({
                  success: true,
                  message: "Event deleted successfully",
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to delete event");
      }
};
