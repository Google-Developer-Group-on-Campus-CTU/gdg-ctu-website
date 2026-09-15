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
                  return res.status(400).json({
                        success: false,
                        message: "Event cover image is required",
                  });
            }

            const clerkId = getClerkIdFromRequest(req);
            if (file && !clerkId) {
                  return res.status(401).json({
                        success: false,
                        message: "Unable to determine uploader (Clerk ID) for image upload",
                  });
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
            const slug = getStringParam(req.params.slug, "slug");
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

            const clerkId = getClerkIdFromRequest(req);
            if (file && !clerkId) {
                  return res.status(401).json({
                        success: false,
                        message: "Unable to determine uploader (Clerk ID) for image upload",
                  });
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
