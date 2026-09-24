import { AppError } from "../../../utils/http.js";
import logger from "../../../utils/logger.js";
import { deleteMediaCloudinaryService } from "../cloudinary.services.js";

export interface CloudinaryUploadResult {
      public_id: string;
      resource_type: "image" | "video" | "raw" | "auto";
}

export const isCloudinaryDisabledError = (error: unknown): boolean =>
      (error instanceof AppError && error.statusCode === 503) ||
      (typeof (error as { message?: unknown })?.message === "string" &&
            (error as { message: string }).message.includes("not configured"));

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
