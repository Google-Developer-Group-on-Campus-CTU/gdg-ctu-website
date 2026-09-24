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
import { isCloudinaryDisabledError } from "../../config/cloudinary/utils/cloudinary-rollback-helper.js";
import { MediaRecordSchema, CreateMediaInput, UpdateMediaInput } from "./media.validations.js";
import logger from "../../utils/logger.js";
import { NewMediaRecord } from "./models/media.queries.js";

export const createMediaService = async (data: CreateMediaInput) => {
      // Service-boundary validation: callers pass DB-shaped records (never
      // `any`), Zod enforces the column contract before any I/O.
      const valid = MediaRecordSchema.parse(data);
      if (!(await getAdminById(valid.uploadedBy))) {
            throw new AppError(
                  400,
                  "uploadedBy must reference an existing admin",
            );
      }

      const record: NewMediaRecord = {
            uploadedBy: valid.uploadedBy,
            altText: valid.altText ?? null,
            cloudinaryAssetId: valid.cloudinaryAssetId,
            publicId: valid.publicId,
            secureUrl: valid.secureUrl,
            resourceType: valid.resourceType,
            format: valid.format ?? null,
            width: valid.width ?? null,
            height: valid.height ?? null,
            bytes: valid.bytes ?? null,
            originalFilename: valid.originalFilename ?? null,
      };
      return insertMedia(record);
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
      const [media, total] = await Promise.all([
            getMedia(pagination),
            countMedia(),
      ]);

      return {
            media,
            pagination: getPaginationMeta(pagination, total),
      };
};

export const getMediaByIdService = async (id: string) => {
      const media = await getMediaById(id);
      if (!media) {
            throw new AppError(404, "Media not found");
      }

      return media;
};

export const updateMediaService = async (id: string, data: UpdateMediaInput) => {
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

      // Orphan order: delete the DB row FIRST. A DB failure then skips the
      // cloud delete (nothing orphaned); a cloud failure afterwards only
      // leaks a Cloudinary asset, which is logged — never thrown — so the
      // delete request still succeeds.
      await deleteMedia(id);

      try {
            await deleteMediaCloudinaryService(
                  media.publicId,
                  media.resourceType as "image" | "video" | "raw",
            );
      } catch (error: any) {
            if (isCloudinaryDisabledError(error)) {
                  logger.warn(
                        "Cloudinary disabled - skipping Cloudinary delete, DB record already removed",
                  );
            } else {
                  logger.error(
                        "Cloudinary delete failed after DB delete - orphaned cloud asset",
                        {
                              publicId: media.publicId,
                              message: error?.message ?? String(error),
                              stack: error?.stack,
                        },
                  );
            }
      }
};
