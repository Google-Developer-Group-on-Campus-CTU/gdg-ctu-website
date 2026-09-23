import { AppError } from "../../../utils/http.js";
import logger from "../../../utils/logger.js";
import { deleteMediaCloudinaryService } from "../cloudinary.services.js";

export interface CloudinaryUploadResult {
      public_id: string;
      resource_type: "image" | "video" | "raw" | "auto";
}

const isCloudinaryDisabledError = (error: any): boolean =>
      (error instanceof AppError && error.statusCode === 503) ||
      (typeof error?.message === "string" &&
            error.message.includes("not configured"));

export const rollbackCloudinaryUpload = async (
      uploadResult: CloudinaryUploadResult,
) => {
      try {
            await deleteMediaCloudinaryService(
                  uploadResult.public_id,
                  uploadResult.resource_type === "auto"
                        ? "image"
                        : uploadResult.resource_type,
            );
      } catch (error: any) {
            if (isCloudinaryDisabledError(error)) {
                  logger.warn("Cloudinary disabled - skipping upload rollback");
                  return;
            }

            logger.error("Failed to rollback Cloudinary upload", {
                  publicId: uploadResult.public_id,
                  message: error.message,
            });
      }
};
