import { deleteMediaCloudinaryService } from "../../config/cloudinary/cloudinary.services.js";
import { AppError } from "../../utils/http.js";
import { getAdminById } from "../admins/models/admin.queries.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import {
      countMedia,
      deleteMedia,
      getMedia,
      getMediaById,
      insertMedia,
      insertBulkMedia,
      mediaHasReferences,
      updateMedia,
} from "./models/media.queries.js";
import { UpdateMediaDTO, Media } from "./media.validations.js";
import {
      getCache,
      setCache,
      deleteCache,
      clearCacheByPrefix,
} from "../../config/redis/redis.services.js";
import logger from "../../utils/logger.js";
import { NewMediaRecord } from "./models/media.queries.js";

// Cache TTL in seconds for setCache (its ttl parameter is seconds, not ms)
const DEFAULT_CACHE_TTL_SECONDS = 60;

export const createMediaService = async (data: any) => {
      if (!(await getAdminById(data.uploadedBy))) {
            throw new AppError(
                  400,
                  "uploadedBy must reference an existing admin",
            );
      }

      await clearCacheByPrefix("media:");
      return insertMedia(data);
};

/**
 * This media function inserts bulk media records into the local DB and...
 * returns their generated IDs for reference purposes
 */
export const insertBulkMediaService = async (records: NewMediaRecord[]) => {
      if (!records.length) {
            throw new AppError(400, "Missing bulk media, cannot proceed");
      }

      return insertBulkMedia(records);
};

export const getMediaService = async (pagination: Pagination) => {
      const cacheKey = `media:${pagination.page}:${pagination.limit}`;

      // Check Cache
      const cached = await getCache<{
            media: Media[];
            pagination: ReturnType<typeof getPaginationMeta>;
      }>(cacheKey);

      if (cached) return cached;

      // Cache Miss
      const [media, total] = await Promise.all([
            getMedia(pagination),
            countMedia(),
      ]);

      const res = {
            media,
            pagination: getPaginationMeta(pagination, total),
      };

      await setCache(cacheKey, res, DEFAULT_CACHE_TTL_SECONDS);
      return res;
};

export const getMediaByIdService = async (id: string) => {
      const cacheKey = `media:${id}`;
      const cachedMedia = await getCache<Media>(cacheKey);
      if (cachedMedia) return cachedMedia;

      const media = await getMediaById(id);
      if (!media) {
            throw new AppError(404, "Media not found");
      }

      await setCache(cacheKey, media, DEFAULT_CACHE_TTL_SECONDS);
      return media;
};

export const updateMediaService = async (id: string, data: UpdateMediaDTO) => {
      const media = await getMediaById(id);

      if (!media) {
            throw new AppError(404, "Media not found");
      }

      if (data.uploadedBy && !(await getAdminById(data.uploadedBy))) {
            throw new AppError(
                  400,
                  "uploadedBy must reference an existing admin",
            );
      }

      await deleteCache(`media:${id}`);
      await clearCacheByPrefix("media:");
      return updateMedia(id, data);
};

export const deleteMediaService = async (id: string) => {
      const media = await getMediaById(id);

      if (!media) {
            throw new AppError(404, "Media not found");
      }

      if (await mediaHasReferences(id)) {
            throw new AppError(
                  409,
                  "Media cannot be deleted while referenced by team members, event speakers, events, or site content",
            );
      }

      // Delete from Cloudinary using publicId and resourceType.
      // Tolerate Cloudinary being disabled (503) so DB cleanup still proceeds.
      try {
            await deleteMediaCloudinaryService(
                  media.publicId,
                  media.resourceType as "image" | "video" | "raw",
            );
      } catch (error: any) {
            if (
                  (error instanceof AppError && error.statusCode === 503) ||
                  (typeof error?.message === "string" &&
                        error.message.includes("not configured"))
            ) {
                  logger.warn(
                        "Cloudinary disabled - skipping Cloudinary delete, removing DB record only",
                  );
            } else {
                  throw error;
            }
      }

      await deleteCache(`media:${id}`);
      await clearCacheByPrefix("media:");
      await deleteMedia(id);
};
