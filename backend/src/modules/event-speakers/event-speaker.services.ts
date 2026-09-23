import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import { getMediaById } from "../media/models/media.queries.js";
import { getTeamMemberById } from "../team-members/models/team-member.queries.js";
import { createMediaService } from "../media/media.services.js";
import {
      uploadMedia,
} from "../../config/cloudinary/cloudinary.services.js";
import { createMediaRecord } from "../../config/cloudinary/utils/cloudinary-media-data-helper.js";
import {
      rollbackCloudinaryUpload,
      CloudinaryUploadResult,
} from "../../config/cloudinary/utils/cloudinary-rollback-helper.js";
import { cleanupReplacedMedia } from "../../utils/mediaHelper.js";
import { assertAdminExists } from "../auth/assertAdminExistsHelper.js";
import logger from "../../utils/logger.js";
import {
      countEventSpeakers,
      countEventSpeakersByTeamMemberId,
      deleteEventSpeaker,
      getEventSpeakerById,
      getEventSpeakerBySlug,
      getEventSpeakers,
      getEventSpeakersByTeamMemberId,
      insertEventSpeaker,
      updateEventSpeaker,
} from "./models/event-speaker.queries.js";
import {
      CreateEventSpeakerDTO,
      UpdateEventSpeakerDTO,
      EventSpeaker,
} from "./event-speaker.validations.js";
import {
      getCache,
      setCache,
      deleteCache,
      clearCacheByPrefix,
} from "../../config/redis/redis.services.js";

// Constant value for cache timeout
const DEFAULT_CACHE_TIME_TO_LIVE = 60000;
const DEFAULT_SPEAKER_MEDIA_FOLDER = "event-speakers-media";

/** Optional multipart context: profile image upload parity with events/team/partners. */
export interface EventSpeakerUploadContext {
      file?: Buffer;
      uploadedBy?: string;
}

const validateEventSpeakerReferences = async (
      data: Partial<
            Pick<CreateEventSpeakerDTO, "profileMediaId" | "teamMemberId">
      >,
) => {
      if (data.profileMediaId && !(await getMediaById(data.profileMediaId))) {
            throw new AppError(
                  400,
                  "profileMediaId must reference existing media",
            );
      }

      if (data.teamMemberId && !(await getTeamMemberById(data.teamMemberId))) {
            throw new AppError(
                  400,
                  "teamMemberId must reference an existing team member",
            );
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

                  uploadResult = await uploadMedia(upload.file, {
                        folder: DEFAULT_SPEAKER_MEDIA_FOLDER,
                        resourceType: "image",
                  });
                  const mediaData = createMediaRecord(
                        uploadResult,
                        upload.uploadedBy,
                  );
                  const mediaRecord = await createMediaService(mediaData);
                  profileMediaId = mediaRecord.id;
            }

            await validateEventSpeakerReferences({
                  ...data,
                  profileMediaId,
            });

            await clearCacheByPrefix("speakers:");
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

export const getEventSpeakersService = async (pagination: Pagination) => {
      const cacheKey = `speakers:${pagination.page}:${pagination.limit}`;

      // Check Cache
      const cached = await getCache<{
            eventSpeakers: EventSpeaker[];
            pagination: ReturnType<typeof getPaginationMeta>;
      }>(cacheKey);

      if (cached) return cached;

      // Cache Miss
      const [eventSpeakers, total] = await Promise.all([
            getEventSpeakers(pagination),
            countEventSpeakers(),
      ]);

      const res = {
            eventSpeakers,
            pagination: getPaginationMeta(pagination, total),
      };

      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);
      return res;
};

export const getEventSpeakerByIdService = async (id: string) => {
      const cacheKey = `speakers:${id}`;
      const cachedSpeaker = await getCache<EventSpeaker>(cacheKey);
      if (cachedSpeaker) return cachedSpeaker;

      const eventSpeaker = await getEventSpeakerById(id);
      if (!eventSpeaker) {
            throw new AppError(404, "Event speaker not found");
      }

      await setCache(cacheKey, eventSpeaker, DEFAULT_CACHE_TIME_TO_LIVE);
      return eventSpeaker;
};

export const getEventSpeakerBySlugService = async (slug: string) => {
      const cacheKey = `speakers:${slug}`;
      const cachedSpeakerSlug = await getCache<EventSpeaker>(cacheKey);
      if (cachedSpeakerSlug) return cachedSpeakerSlug;

      const eventSpeaker = await getEventSpeakerBySlug(slug);
      if (!eventSpeaker) {
            throw new AppError(404, "Event speaker not found");
      }

      await setCache(cacheKey, eventSpeaker, DEFAULT_CACHE_TIME_TO_LIVE);
      return eventSpeaker;
};

export const getEventSpeakersByTeamMemberIdService = async (
      teamMemberId: string,
      pagination: Pagination,
) => {
      if (!(await getTeamMemberById(teamMemberId))) {
            throw new AppError(404, "Team member not found");
      }

      const cacheKey = `speaker:${teamMemberId}:${pagination.page}:${pagination.limit}`;

      // Check Cache
      const cached = await getCache<{
            eventSpeakers: EventSpeaker[];
            pagination: ReturnType<typeof getPaginationMeta>;
      }>(cacheKey);

      if (cached) return cached;

      // Cache Miss
      const [eventSpeakers, total] = await Promise.all([
            getEventSpeakersByTeamMemberId(teamMemberId, pagination),
            countEventSpeakersByTeamMemberId(teamMemberId),
      ]);

      const res = {
            eventSpeakers,
            pagination: getPaginationMeta(pagination, total),
      };

      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);
      return res;
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

                  uploadResult = await uploadMedia(upload.file, {
                        folder: DEFAULT_SPEAKER_MEDIA_FOLDER,
                        resourceType: "image",
                  });
                  const mediaData = createMediaRecord(
                        uploadResult,
                        upload.uploadedBy,
                  );
                  const mediaRecord = await createMediaService(mediaData);
                  newProfileMediaId = mediaRecord.id;
            }

            await validateEventSpeakerReferences(
                  upload?.file
                        ? { ...data, profileMediaId: newProfileMediaId }
                        : data,
            );

            await deleteCache(`speakers:${id}`);
            await clearCacheByPrefix(`speakers:`);

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

      await deleteCache(`speakers:${id}`);
      await clearCacheByPrefix("speakers:");
      await deleteEventSpeaker(id);
};
