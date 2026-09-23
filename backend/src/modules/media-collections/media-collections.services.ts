import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import { getAdminById } from "../admins/models/admin.queries.js";
import { getMediaById } from "../media/models/media.queries.js";
import {
      insertMediaCollection,
      getMediaCollections,
      countMediaCollections,
      getMediaCollectionById,
      getMediaCollectionBySlug,
      updateMediaCollection,
      deleteMediaCollection,
} from "./models/media-collection.queries.js";
import {
      CreateMediaCollectionDTO,
      MediaCollectionRecord,
      UpdateMediaCollectionDTO,
} from "./media-collections.validations.js";
import {
      getCache,
      setCache,
      deleteCache,
      clearCacheByPrefix,
} from "../../config/redis/redis.services.js";

// Cache TTL in seconds for setCache (its ttl parameter is seconds, not ms)
const DEFAULT_CACHE_TTL_SECONDS = 60;

export const toMediaCollectionResponse = (col: MediaCollectionRecord) => col; // no sensitive fields

export const createMediaCollectionService = async (
      data: CreateMediaCollectionDTO,
) => {
      // Read-level slug 409 — matches events/team/partners/site-content (slug
      // is unique in the DB, but this returns a clean 409 instead of a raw
      // constraint error).
      if (await getMediaCollectionBySlug(data.slug)) {
            throw new AppError(409, "Album slug already exists");
      }
      if (!(await getAdminById(data.createdBy))) {
            throw new AppError(
                  400,
                  "createdBy must reference an existing admin",
            );
      }
      if (data.coverMediaId && !(await getMediaById(data.coverMediaId))) {
            throw new AppError(
                  400,
                  "coverMediaId must reference existing media",
            );
      }

      const col = await insertMediaCollection(data);

      await clearCacheByPrefix("collections:");
      return toMediaCollectionResponse(col);
};

export const listMediaCollectionsService = async (pagination: Pagination) => {
      const cacheKey = `collections:${pagination.page}:${pagination.limit}`;

      // Check Cache
      const cached = await getCache<{
            collections: MediaCollectionRecord[];
            pagination: ReturnType<typeof getPaginationMeta>;
      }>(cacheKey);

      if (cached) return cached;

      // Cache Miss
      const [collections, total] = await Promise.all([
            getMediaCollections(pagination),
            countMediaCollections(),
      ]);

      const res = {
            collections: collections.map(toMediaCollectionResponse),
            pagination: getPaginationMeta(pagination, total),
      };

      await setCache(cacheKey, res, DEFAULT_CACHE_TTL_SECONDS);
      return res;
};

export const getMediaCollectionService = async (id: string) => {
      const cacheKey = `collections:${id}`;
      const cachedCollection = await getCache<MediaCollectionRecord>(cacheKey);
      if (cachedCollection) return cachedCollection;

      const col = await getMediaCollectionById(id);
      if (!col) {
            throw new AppError(404, "Media collection not found");
      }

      const res = toMediaCollectionResponse(col);

      await setCache(cacheKey, res, DEFAULT_CACHE_TTL_SECONDS);
      return res;
};

export const updateMediaCollectionService = async (
      id: string,
      data: UpdateMediaCollectionDTO,
) => {
      const existing = await getMediaCollectionById(id);
      if (!existing) {
            throw new AppError(404, "Media collection not found");
      }

      if (data.slug && data.slug !== existing.slug) {
            const slugOwner = await getMediaCollectionBySlug(data.slug);
            if (slugOwner) {
                  throw new AppError(409, "Album slug already exists");
            }
      }

      if (data.createdBy && !(await getAdminById(data.createdBy))) {
            throw new AppError(
                  400,
                  "createdBy must reference an existing admin",
            );
      }

      if (data.coverMediaId && !(await getMediaById(data.coverMediaId))) {
            throw new AppError(
                  400,
                  "coverMediaId must reference existing media",
            );
      }

      const updated = await updateMediaCollection(id, data);

      await deleteCache(`collections:${id}`);
      await clearCacheByPrefix("collections:");

      return toMediaCollectionResponse(updated);
};

export const deleteMediaCollectionService = async (id: string) => {
      const existing = await getMediaCollectionById(id);
      if (!existing) {
            throw new AppError(404, "Media collection not found");
      }
      
      // Optional: could check for items referencing collection before delete
      await deleteCache(`collections:${id}`);
      await clearCacheByPrefix("collections:");
      await deleteMediaCollection(id);
};
