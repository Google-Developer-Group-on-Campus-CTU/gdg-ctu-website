import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import { uploadMedia } from "../../config/cloudinary/cloudinary.services.js";
import { createMediaRecord } from "../../config/cloudinary/utils/cloudinary-media-data-helper.js";
import { createMediaService } from "../media/media.services.js";
import { getMediaById } from "../media/models/media.queries.js";
import { cleanupReplacedMedia } from "../../utils/mediaHelper.js";
import {
      rollbackCloudinaryUpload,
      CloudinaryUploadResult,
} from "../../config/cloudinary/utils/cloudinary-rollback-helper.js";
import {
      countPartners,
      deletePartner,
      getActivePartners,
      getPartnerById,
      getPartnerBySlug,
      getPartners,
      insertPartner,
      updatePartner,
} from "./models/partner.queries.js";
import { CreatePartnerDTO, UpdatePartnerDTO } from "./partner.validations.js";
import logger from "../../utils/logger.js";
import { assertAdminExists } from "../auth/assertAdminExistsHelper.js";

// Folder directory for partners media
const DEFAULT_PARTNERS_MEDIA_FOLDER = "partners-media";

export const createPartnerService = async (
      data: CreatePartnerDTO,
      userId: string,
      file?: Buffer,
) => {
      if (await getPartnerBySlug(data.slug)) {
            throw new AppError(409, "Partner slug already exists");
      }

      if (!userId) {
            throw new AppError(401, "Unauthorized: user ID missing");
      }
      await assertAdminExists(userId);

      let uploadResult: CloudinaryUploadResult | null = null;
      try {
            // If a logo image is supplied, upload to Cloudinary and create media record
            let logoMediaId = data.logoMediaId ?? undefined;
            if (file) {
                  const uploadResult = await uploadMedia(file, {
                        folder: DEFAULT_PARTNERS_MEDIA_FOLDER,
                        resourceType: "image",
                  });
                  const mediaData = createMediaRecord(uploadResult, userId);
                  const mediaRecord = await createMediaService(mediaData);
                  logoMediaId = mediaRecord.id;
            } else {
                  throw new AppError(
                        400,
                        "Partner Logo/Cover Image is required",
                  );
            }

            const partner = await insertPartner({
                  ...data,
                  logoMediaId,
                  createdBy: userId,
                  updatedBy: userId,
                  updatedAt: new Date(),
            });
            return partner;
      } catch (error: any) {
            if (uploadResult) {
                  await rollbackCloudinaryUpload(uploadResult);
            }

            // Log the actual root cause before throwing the AppError
            logger.error("Root cause for partner creation failure:", {
                  message: error.message,
                  stack: error.stack,
            });

            throw new AppError(
                  400,
                  `Failed to create partner: ${error.message}`,
            );
      }
};

export const getPartnersService = async (pagination: Pagination) => {
      const [partnerList, total] = await Promise.all([
            getPartners(pagination),
            countPartners(),
      ]);

      return {
            partners: partnerList,
            pagination: getPaginationMeta(pagination, total),
      };
};

export const getPartnerByIdService = async (id: string) => {
      const partner = await getPartnerById(id);
      if (!partner) {
            throw new AppError(404, "Partner not found");
      }
      return partner;
};

export const getPartnerBySlugService = async (slug: string) => {
      const partner = await getPartnerBySlug(slug);
      if (!partner) {
            throw new AppError(404, "Partner not found");
      }
      return partner;
};

/** Public feed: active only, tier-ordered. Safe fields (no internal IDs beyond slug). */
export const getPublicPartnersService = async () => {
      return getActivePartners();
};

export const updatePartnerService = async (
      id: string,
      data: UpdatePartnerDTO,
      userId: string,
      file?: Buffer,
) => {
      const partner = await getPartnerById(id);
      if (!partner) {
            throw new AppError(404, "Partner not found");
      }

      if (data.slug && data.slug !== partner.slug) {
            const existing = await getPartnerBySlug(data.slug);
            if (existing) {
                  throw new AppError(409, "Partner slug already exists");
            }
      }

      // Validate provided logoMediaId if presentw
      if (data.logoMediaId && !(await getMediaById(data.logoMediaId))) {
            throw new AppError(
                  400,
                  "logoMediaId must reference existing media",
            );
      }

      let newLogoMediaId = partner.logoMediaId ?? undefined;
      let uploadResult: CloudinaryUploadResult | null = null;
      try {
            // If a new logo image is supplied, upload it and replace the existing media
            if (file) {
                  uploadResult = await uploadMedia(file, {
                        folder: DEFAULT_PARTNERS_MEDIA_FOLDER,
                        resourceType: "image",
                  });
                  const mediaData = createMediaRecord(uploadResult, userId);
                  const mediaRecord = await createMediaService(mediaData);
                  newLogoMediaId = mediaRecord.id;
            }

            // Update partner record – logoMediaId will stay the same if no new file
            const updated = await updatePartner(id, {
                  ...data,
                  logoMediaId: newLogoMediaId,
                  updatedBy: userId,
                  updatedAt: new Date(),
            });
            // Delete the previous logo media (if it existed)
            await cleanupReplacedMedia(partner.logoMediaId, newLogoMediaId);
            return updated;
      } catch (error: any) {
            if (uploadResult) {
                  await rollbackCloudinaryUpload(uploadResult);
            }

            logger.error("Root cause for partner update failure:", {
                  message: error.message,
                  stack: error.stack,
            });
            throw new AppError(
                  400,
                  `Failed to update partner: ${error.message}`,
            );
      }
};

export const deletePartnerService = async (id: string) => {
      const partner = await getPartnerById(id);
      if (!partner) {
            throw new AppError(404, "Partner not found");
      }

      await deletePartner(id);
      await cleanupReplacedMedia(partner.logoMediaId, null);
};
