import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import { getMediaById } from "../media/models/media.queries.js";
import { recordUpload } from "../media/media.uploads.js";
import {
      rollbackCloudinaryUpload,
      CloudinaryUploadResult,
} from "../../config/cloudinary/utils/cloudinary-rollback-helper.js";
import { cleanupReplacedMedia } from "../../utils/mediaHelper.js";
import { assertAdminExists } from "../auth/assertAdminExistsHelper.js";
import logger from "../../utils/logger.js";
import {
      countEventSpeakers,
      countEventSpeakersByEventId,
      countEventSpeakersByTeamMemberId,
      deleteEventSpeaker,
      getEventSpeakerById,
      getEventSpeakerBySlug,
      getEventSpeakers,
      getEventSpeakersByEventId,
      getEventSpeakersByTeamMemberId,
      insertEventSpeaker,
      updateEventSpeaker,
} from "./models/event-speaker.queries.js";
import {
      checkEventExists,
      checkTeamMemberExists,
} from "../event-roster/event-roster.services.js";
import { getTeamMemberById } from "../team-members/models/team-member.queries.js";
import {
      CreateEventSpeakerDTO,
      UpdateEventSpeakerDTO,
} from "./event-speaker.validations.js";

const DEFAULT_SPEAKER_MEDIA_FOLDER = "event-speakers-media";

/** Optional multipart context: profile image upload parity with events/team/partners. */
export interface EventSpeakerUploadContext {
      file?: Buffer;
      uploadedBy?: string;
}

const validateEventSpeakerReferences = async (
      data: Partial<
            Pick<
                  CreateEventSpeakerDTO,
                  "profileMediaId" | "teamMemberId" | "eventId"
            >
      >,
) => {
      // Media check stays local: media is not part of the roster seam.
      if (data.profileMediaId && !(await getMediaById(data.profileMediaId))) {
            throw new AppError(
                  400,
                  "profileMediaId must reference existing media",
            );
      }

      if (data.teamMemberId) {
            await checkTeamMemberExists(data.teamMemberId);
      }

      // eventId is nullable — only validate when a value is supplied so
      // null/absent keeps its existing semantics.
      if (data.eventId) {
            await checkEventExists(data.eventId);
      }
};

export const createEventSpeakerService = async (
      data: CreateEventSpeakerDTO,
      upload?: EventSpeakerUploadContext,
) => {
      if (await getEventSpeakerBySlug(data.slug)) {
            throw new AppError(409, "Event speaker slug already exists");
      }

      let uploadResult: CloudinaryUploadResult | null = null;
      try {
            let profileMediaId = data.profileMediaId ?? undefined;

            // Optional profile image — uploaded first so FK validation covers it.
            if (upload?.file) {
                  if (!upload.uploadedBy) {
                        throw new AppError(
                              401,
                              "Admin ID missing: Unauthorized",
                        );
                  }
                  await assertAdminExists(upload.uploadedBy);

                  const recorded = await recordUpload({
                        file: upload.file,
                        meta: {
                              folder: DEFAULT_SPEAKER_MEDIA_FOLDER,
                              uploadedBy: upload.uploadedBy,
                        },
                  });
                  uploadResult = recorded.uploadResult;
                  profileMediaId = recorded.mediaId;
            }

            await validateEventSpeakerReferences({
                  ...data,
                  profileMediaId,
            });

            return await insertEventSpeaker({ ...data, profileMediaId });
      } catch (error: any) {
            if (uploadResult) {
                  await rollbackCloudinaryUpload(uploadResult);
            }

            logger.error("Failed to create event speaker", {
                  message: error.message,
                  stack: error.stack,
            });

            if (error instanceof AppError) {
                  throw error;
            }

            throw new AppError(
                  400,
                  `Failed to create event speaker: ${error.message}`,
            );
      }
};

export const getEventSpeakersService = async (
      pagination: Pagination,
      eventId?: string,
) => {
      // Optional ?eventId filter: 404 when the event does not exist.
      if (eventId) {
            await checkEventExists(eventId);
      }

      const [eventSpeakers, total] = await Promise.all([
            eventId
                  ? getEventSpeakersByEventId(eventId, pagination)
                  : getEventSpeakers(pagination),
            eventId
                  ? countEventSpeakersByEventId(eventId)
                  : countEventSpeakers(),
      ]);

      return {
            eventSpeakers,
            pagination: getPaginationMeta(pagination, total),
      };
};

export const getEventSpeakerByIdService = async (id: string) => {
      const eventSpeaker = await getEventSpeakerById(id);
      if (!eventSpeaker) {
            throw new AppError(404, "Event speaker not found");
      }

      return eventSpeaker;
};

export const getEventSpeakerBySlugService = async (slug: string) => {
      const eventSpeaker = await getEventSpeakerBySlug(slug);
      if (!eventSpeaker) {
            throw new AppError(404, "Event speaker not found");
      }

      return eventSpeaker;
};

export const getEventSpeakersByTeamMemberIdService = async (
      teamMemberId: string,
      pagination: Pagination,
) => {
      if (!(await getTeamMemberById(teamMemberId))) {
            throw new AppError(404, "Team member not found");
      }

      const [eventSpeakers, total] = await Promise.all([
            getEventSpeakersByTeamMemberId(teamMemberId, pagination),
            countEventSpeakersByTeamMemberId(teamMemberId),
      ]);

      return {
            eventSpeakers,
            pagination: getPaginationMeta(pagination, total),
      };
};

export const updateEventSpeakerService = async (
      id: string,
      data: UpdateEventSpeakerDTO,
      upload?: EventSpeakerUploadContext,
) => {
      const eventSpeaker = await getEventSpeakerById(id);

      if (!eventSpeaker) {
            throw new AppError(404, "Event speaker not found");
      }

      if (data.slug && data.slug !== eventSpeaker.slug) {
            const existingEventSpeaker = await getEventSpeakerBySlug(data.slug);

            if (existingEventSpeaker) {
                  throw new AppError(409, "Event speaker slug already exists");
            }
      }

      const oldProfileMediaId = eventSpeaker.profileMediaId ?? undefined;

      let uploadResult: CloudinaryUploadResult | null = null;
      try {
            let newProfileMediaId = oldProfileMediaId;

            // Optional new profile image — upload and link before validating refs.
            if (upload?.file) {
                  if (!upload.uploadedBy) {
                        throw new AppError(
                              401,
                              "Admin ID missing: Unauthorized",
                        );
                  }
                  await assertAdminExists(upload.uploadedBy);

                  const recorded = await recordUpload({
                        file: upload.file,
                        meta: {
                              folder: DEFAULT_SPEAKER_MEDIA_FOLDER,
                              uploadedBy: upload.uploadedBy,
                        },
                  });
                  uploadResult = recorded.uploadResult;
                  newProfileMediaId = recorded.mediaId;
            }

            await validateEventSpeakerReferences(
                  upload?.file
                        ? { ...data, profileMediaId: newProfileMediaId }
                        : data,
            );

            const updated = await updateEventSpeaker(id, {
                  ...data,
                  ...(upload?.file ? { profileMediaId: newProfileMediaId } : {}),
                  updatedAt: new Date(),
            });

            // Remove the replaced profile media once nothing references it anymore.
            await cleanupReplacedMedia(oldProfileMediaId, newProfileMediaId);
            return updated;
      } catch (error: any) {
            if (uploadResult) {
                  await rollbackCloudinaryUpload(uploadResult);
            }

            logger.error("Failed to update event speaker", {
                  message: error.message,
                  stack: error.stack,
            });

            if (error instanceof AppError) {
                  throw error;
            }

            throw new AppError(400, "Failed to update event speaker");
      }
};

export const deleteEventSpeakerService = async (id: string) => {
      const eventSpeaker = await getEventSpeakerById(id);

      if (!eventSpeaker) {
            throw new AppError(404, "Event speaker not found");
      }

      await deleteEventSpeaker(id);
};
