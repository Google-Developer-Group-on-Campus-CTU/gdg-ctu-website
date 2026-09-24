import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import { getAdminByIdService } from "../admins/admin.services.js";
import { recordUpload } from "../media/media.uploads.js";
import { EventStatus } from "./models/event.js";
import {
      countEvents,
      deleteEvent,
      getEventById,
      getEventBySlug,
      getEvents,
      insertEvent,
      NewEventRecord,
      updateEvent,
} from "./models/event.queries.js";
import { CreateEventDTO, UpdateEventDTO } from "./event.validations.js";
import { cleanupReplacedMedia } from "../../utils/mediaHelper.js";
import {
      rollbackCloudinaryUpload,
      CloudinaryUploadResult,
} from "../../config/cloudinary/utils/cloudinary-rollback-helper.js";
import logger from "../../utils/logger.js";
import { assertAdminExists } from "../auth/assertAdminExistsHelper.js";

const DEFAULT_EVENT_MEDIA_FOLDER = "event-media";

// HELPER VALIDATION FUNCTIONS
const getPublishedAtForStatus = (
      status: EventStatus | undefined,
      existingPublishedAt?: Date | null,
) => {
      if (!status) {
            return undefined;
      }

      if (status === "published") {
            return existingPublishedAt ?? new Date();
      }

      return null;
};
// END OF HELPER VALIDATION FUNCTIONS

// MAIN SERVICE FUNCTIONS
interface CreateEventDataWithImageDTO {
      eventData: CreateEventDTO;
      file?: Buffer;
      uploadedBy?: string;
}
interface UpdateEventDataWithImageDTO {
      id: string;
      event: UpdateEventDTO;
      file?: Buffer;
      uploadedBy?: string;
}

export const createEventService = async (data: CreateEventDataWithImageDTO) => {
      if (await getEventBySlug(data.eventData.slug)) {
            throw new AppError(409, "Event slug already exists");
      }

      if (!data.uploadedBy) {
            throw new AppError(401, "Admin ID missing: Unauthorized");
      }

      await assertAdminExists(data.uploadedBy);
      let coverMediaId = data.eventData.coverMediaId ?? undefined;

      let uploadResult: CloudinaryUploadResult | null = null;
      try {
            // If an image file is provided, upload to Cloudinary and create a media record
            if (data.file && data.uploadedBy) {
                  const recorded = await recordUpload({
                        file: data.file,
                        meta: {
                              folder: DEFAULT_EVENT_MEDIA_FOLDER,
                              uploadedBy: data.uploadedBy,
                        },
                  });
                  uploadResult = recorded.uploadResult;
                  coverMediaId = recorded.mediaId;
            }

            const eventData: NewEventRecord = {
                  ...data.eventData,
                  createdBy: data.uploadedBy,
                  coverMediaId,
                  publishedAt: getPublishedAtForStatus(data.eventData.status),
            };

            const event = await insertEvent(eventData);
            return event;
      } catch (error: any) {
            if (uploadResult) {
                  await rollbackCloudinaryUpload(uploadResult);
            }

            logger.error("Failed to create event data", {
                  message: error.message,
                  stack: error.stack,
            });

            if (error instanceof AppError) {
                  throw error;
            }

            throw new AppError(400, "Failed to create event data");
      }
};

export const getEventsService = async (pagination: Pagination) => {
      const [events, total] = await Promise.all([
            getEvents(pagination),
            countEvents(),
      ]);

      return {
            events,
            pagination: getPaginationMeta(pagination, total),
      };
};

export const getEventByIdService = async (id: string) => {
      const event = await getEventById(id);
      if (!event) {
            throw new AppError(404, "Event not found");
      }

      return event;
};

export const getEventBySlugService = async (slug: string) => {
      const event = await getEventBySlug(slug);
      if (!event) {
            throw new AppError(404, "Event not found");
      }

      return event;
};

export const updateEventService = async (data: UpdateEventDataWithImageDTO) => {
      const event = await getEventById(data.id);
      if (!event) {
            throw new AppError(404, "Event not found");
      }

      if (data.event.slug && data.event.slug !== event.slug) {
            const existingEvent = await getEventBySlug(data.event.slug);

            if (existingEvent) {
                  throw new AppError(409, "Event slug already exists");
            }
      }

      if (!data.uploadedBy) {
            throw new AppError(401, "Admin ID missing: Unauthorized");
      }
      await assertAdminExists(data.uploadedBy);

      const startAt = data.event.startAt ?? event.startAt;
      const endAt = data.event.endAt ?? event.endAt;

      if (endAt < startAt) {
            throw new AppError(400, "endAt must not be earlier than startAt");
      }

      // Keep track of existing cover media so we can clean up if replaced
      const oldCoverMediaId = event.coverMediaId ?? undefined;

      // Track the Cloudinary upload result so we can roll back if DB fails
      let uploadResult: CloudinaryUploadResult | null = null;
      try {
            let newCoverMediaId = oldCoverMediaId;

            // If a new image file is supplied, upload it and create a new media record.
            if (data.file && data.uploadedBy) {
                  const recorded = await recordUpload({
                        file: data.file,
                        meta: {
                              folder: DEFAULT_EVENT_MEDIA_FOLDER,
                              uploadedBy: data.uploadedBy,
                        },
                  });
                  uploadResult = recorded.uploadResult;
                  newCoverMediaId = recorded.mediaId;
            }

            // Prepare the update payload, including possibly new coverMediaId
            const eventUpdate: Partial<NewEventRecord> = {
                  ...data.event,
                  coverMediaId: newCoverMediaId,
                  updatedAt: new Date(),
            };

            const publishedAt = getPublishedAtForStatus(
                  data.event.status,
                  event.publishedAt,
            );

            if (publishedAt !== undefined) {
                  eventUpdate.publishedAt = publishedAt;
            }

            const updatedEvent = await updateEvent(data.id, eventUpdate);
            await cleanupReplacedMedia(oldCoverMediaId, newCoverMediaId);

            return updatedEvent;
      } catch (error: any) {
            if (uploadResult) {
                  await rollbackCloudinaryUpload(uploadResult);
            }

            logger.error("Failed to update event data", {
                  message: error.message,
                  stack: error.stack,
            });

            if (error instanceof AppError) {
                  throw error;
            }

            throw new AppError(500, "Failed to update event");
      }
};

export const deleteEventService = async (id: string) => {
      const event = await getEventById(id);

      if (!event) {
            throw new AppError(404, "Event not found");
      }

      await deleteEvent(id);
      await cleanupReplacedMedia(event.coverMediaId, null);
};
