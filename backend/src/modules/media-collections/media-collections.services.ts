import { AppError } from "../../utils/http";
import { getPaginationMeta, Pagination } from "../../utils/pagination";
import { getAdminById } from "../admins/models/admin.queries";
import { getMediaById } from "../media/models/media.queries";
import {
      insertMediaCollection,
      getMediaCollections,
      countMediaCollections,
      getMediaCollectionById,
      updateMediaCollection,
      deleteMediaCollection,
      detachMediaFromCollection,
      NewMediaCollectionRecord,
} from "./models/media-collection.queries";
import {
      CreateMediaCollectionDTO,
      MediaCollectionRecord,
      UpdateMediaCollectionDTO,
} from "./media-collections.validations";
import {
      getCache,
      setCache,
      deleteCache,
      clearCacheByPrefix,
} from "../../config/redis/redis.services";
import {
      createMediaService,
      insertBulkMediaService,
} from "../media/media.services";
import {
      assignMediaToCollection,
      removeMediaFromCollectionByIds,
} from "../media/models/media.queries";
import {
      processBulkMediaUpload,
      uploadMedia,
} from "../../config/cloudinary/cloudinary.services";
import { createMediaRecord } from "../../config/cloudinary/utils/cloudinary-media-data-helper";
import {
      CloudinaryUploadResult,
      rollbackCloudinaryUpload,
} from "../../config/cloudinary/utils/cloudinary-rollback-helper";
import logger from "../../utils/logger";

// Constant value for cache timeout
const DEFAULT_CACHE_TIME_TO_LIVE = 60000;
const DEFAULT_MEDIA_COLLECTION_FOLDER = "media-collections";

export const toMediaCollectionResponse = (col: MediaCollectionRecord) => col; // no sensitive fields

export const createMediaCollectionService = async (
      collectionCoverImage: Buffer,
      imageCollections: Express.Multer.File[],
      data: CreateMediaCollectionDTO,
) => {
      if (!collectionCoverImage || !imageCollections) {
            throw new AppError(
                  400,
                  "Collection cover image missing, cannot proceed",
            );
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

      let uploadResult: CloudinaryUploadResult | null = null;
      try {
            // For Cover Image
            const uploadResult = await uploadMedia(collectionCoverImage, {
                  folder: `${DEFAULT_MEDIA_COLLECTION_FOLDER}/${data.name}`,
                  resourceType: "image",
            });
            const mediaData = createMediaRecord(uploadResult, data.createdBy);
            const mediaRecord = await createMediaService(mediaData);

            // For Bulk Image Upload
            let mediaIds: string[] = [];
            if (imageCollections && imageCollections.length > 0) {
                  mediaIds = await processBulkMediaUpload({
                        files: imageCollections,
                        folderPath: `${DEFAULT_MEDIA_COLLECTION_FOLDER}/${data.name}`,
                        uploadedBy: data.createdBy,
                  });
                  console.log("Media Ids", mediaIds);
            }

            const mediaCollectionData: NewMediaCollectionRecord = {
                  ...data,
                  coverMediaId: mediaRecord.id,
                  createdBy: data.createdBy,
            };

            await clearCacheByPrefix("collections:");
            const col = await insertMediaCollection(mediaCollectionData);
            // Associate bulk uploaded images with the newly created collection
            if (mediaIds.length > 0) {
                  await assignMediaToCollection(mediaIds, col.id);
            }
            return toMediaCollectionResponse(col);
      } catch (error: any) {
            if (uploadResult) {
                  await rollbackCloudinaryUpload(uploadResult);
            }

            logger.error("Failed to create Media Collection", {
                  message: error.message,
                  stack: error.stack,
            });

            if (error instanceof AppError) {
                  throw error;
            }

            throw new AppError(400, "Failed to create Media Collection");
      }
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

      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);
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

      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);
      return res;
};

export const updateMediaCollectionService = async (
      id: string,
      data: UpdateMediaCollectionDTO,
      removeMediaIds: string[] = [],
      newImageFiles: Express.Multer.File[] = [],
) => {
      const existing = await getMediaCollectionById(id);
      if (!existing) {
            throw new AppError(404, "Media collection not found");
      }

      // Validate admin and cover media as before
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

      try {
            // 1. Detach any media the user wants removed from this collection
            if (removeMediaIds.length > 0) {
                  await removeMediaFromCollectionByIds(removeMediaIds);
            }

            // 2. Add any new images provided
            if (newImageFiles.length > 0) {
                  // Use collection's name for folder (fallback to existing name)
                  const folderBase = existing.name ?? data.name ?? "collection";
                  const newMediaIds = await processBulkMediaUpload({
                        files: newImageFiles,
                        folderPath: `${DEFAULT_MEDIA_COLLECTION_FOLDER}/${folderBase}`,
                        uploadedBy: data.createdBy ?? existing.createdBy,
                  });
                  await assignMediaToCollection(newMediaIds, id);
            }

            // 3. Update collection metadata (excluding images)
            let updatedCol;
            if (Object.keys(data).length > 0) {
                  updatedCol = await updateMediaCollection(id, data);
            } else {
                  // No metadata changes – just fetch the current collection (includes images)
                  updatedCol = await getMediaCollectionById(id);
            }

            // 4. Invalidate cache
            await deleteCache(`collections:${id}`);
            await clearCacheByPrefix("collections:");

            if (!updatedCol) {
                  throw new AppError(404, "Media collection not found");
            }
            return toMediaCollectionResponse(updatedCol);
      } catch (error: any) {
            logger.error("Failed to update media collection: ", {
                  message: error.message,
                  stack: error.stack,
            });

            if (error instanceof AppError) {
                  throw error;
            }

            throw new AppError(500, "Failed to update media-collection");
      }
};

export const deleteMediaCollectionService = async (id: string) => {
      const existing = await getMediaCollectionById(id);
      if (!existing) {
            throw new AppError(404, "Media collection not found");
      }

      // Optional: could check for items referencing collection before delete
      await deleteCache(`collections:${id}`);
      await clearCacheByPrefix("collections:");
      // Detach images so they remain in the DB but lose the collection reference
      await detachMediaFromCollection(id);
      await deleteMediaCollection(id);
};
