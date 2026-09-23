import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import { getMediaById } from "../media/models/media.queries.js";
import { getMediaCollectionById } from "../media-collections/models/media-collection.queries.js";
import {
      insertMediaCollectionItem,
      getMediaCollectionItems,
      countMediaCollectionItems,
      getMediaCollectionItem,
      updateMediaCollectionItem,
      deleteMediaCollectionItem,
} from "./models/media-collection-item.queries.js";
import {
      CreateMediaCollectionItemDTO,
      MediaCollectionItemRecord,
      UpdateMediaCollectionItemDTO,
} from "./media-collection-items.validations.js";
import {
      getCache,
      setCache,
      deleteCache,
      clearCacheByPrefix,
} from "../../config/redis/redis.services.js";

// Constant value for cache timeout
const DEFAULT_CACHE_TIME_TO_LIVE = 60000;

export const toMediaCollectionItemResponse = (
      item: MediaCollectionItemRecord,
) => item;

export const createMediaCollectionItemService = async (
      data: CreateMediaCollectionItemDTO,
) => {
      if (!(await getMediaCollectionById(data.collectionId))) {
            throw new AppError(
                  400,
                  "collectionId must reference existing collection",
            );
      }

      if (!(await getMediaById(data.mediaId))) {
            throw new AppError(400, "mediaId must reference existing media");
      }

      const item = await insertMediaCollectionItem(data);
      await clearCacheByPrefix("collection-items:");
      return toMediaCollectionItemResponse(item);
};

export const listMediaCollectionItemsService = async (
      pagination: Pagination,
) => {
      const cacheKey = `collection-items:${pagination.page}:${pagination.limit}`;

      // Check Cache
      const cached = await getCache<{
            collections: MediaCollectionItemRecord[];
            pagination: ReturnType<typeof getPaginationMeta>;
      }>(cacheKey);

      if (cached) return cached;

      // Cache Miss
      const [items, total] = await Promise.all([
            getMediaCollectionItems(pagination),
            countMediaCollectionItems(),
      ]);

      const res = {
            items: items.map(toMediaCollectionItemResponse),
            pagination: getPaginationMeta(pagination, total),
      };

      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);
      return res;
};

export const getMediaCollectionItemService = async (
      collectionId: string,
      mediaId: string,
) => {
      const cacheKey = `collection-items:${collectionId}:${mediaId}`;
      const cachedCollection =
            await getCache<MediaCollectionItemRecord>(cacheKey);
      if (cachedCollection) return cachedCollection;

      const item = await getMediaCollectionItem(collectionId, mediaId);
      if (!item) {
            throw new AppError(404, "Media collection item not found");
      }

      const res = toMediaCollectionItemResponse(item);
      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);

      return res;
};

export const updateMediaCollectionItemService = async (
      collectionId: string,
      mediaId: string,
      data: UpdateMediaCollectionItemDTO,
) => {
      const existing = await getMediaCollectionItem(collectionId, mediaId);
      if (!existing) {
            throw new AppError(404, "Media collection item not found");
      }

      // Identity (composite PK) comes from the URL — ignore PK fields in the body.
      const { collectionId: _collectionId, mediaId: _mediaId, ...updates } =
            data;
      if (Object.keys(updates).length === 0) {
            throw new AppError(400, "At least one updatable field is required");
      }

      const item = await updateMediaCollectionItem(collectionId, mediaId, updates);
      await deleteCache(`collection-items:${collectionId}:${mediaId}`);
      await clearCacheByPrefix("collection-items:");
      return toMediaCollectionItemResponse(item);
};

export const deleteMediaCollectionItemService = async (
      collectionId: string,
      mediaId: string,
) => {
      const existing = await getMediaCollectionItem(collectionId, mediaId);
      if (!existing) {
            throw new AppError(404, "Media collection item not found");
      }

      await deleteCache(`collection-items:${collectionId}:${mediaId}`);
      await clearCacheByPrefix("collection-items:");
      await deleteMediaCollectionItem(collectionId, mediaId);
};
