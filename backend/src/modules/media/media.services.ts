import { deleteMediaCloudinaryService } from "../../config/cloudinary/cloudinary.services";
import { AppError } from "../../utils/http";
import { getAdminById } from "../admins/models/admin.queries";
import { getPaginationMeta, Pagination } from "../../utils/pagination";
import {
      countMedia,
      deleteMedia,
      getMedia,
      getMediaById,
      insertMedia,
      mediaHasReferences,
      updateMedia,
} from "./models/media.queries";
import { UpdateMediaDTO, Media } from "./media.validations";
import {
      getCache,
      setCache,
      deleteCache,
      clearCacheByPrefix,
} from "../../config/redis/redis.services";
import logger from "../../utils/logger";

// Constant value for cache timeout
const DEFAULT_CACHE_TIME_TO_LIVE = 60000;

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

      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);
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

      await setCache(cacheKey, media, DEFAULT_CACHE_TIME_TO_LIVE);
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
