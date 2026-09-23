import cloudinary, { isCloudinaryEnabled } from "./cloudinary.config.js";
import logger from "../../utils/logger.js";
import { AppError } from "../../utils/http.js";

/**
 * The sole purpose of this function is to test connectivity to cloudinary.
 * No-ops when CLOUDINARY_URL is not configured so the server can boot
 * without Cloudinary.
 */
export const testCloudinaryConnection = async () => {
      if (!isCloudinaryEnabled()) {
            logger.warn("Cloudinary disabled - skipping connection test");
            return;
      }
      try {
            await cloudinary.api.ping();
            logger.info("Cloudinary Connected Successfully");
      } catch (error: any) {
            logger.error("Failed to Connect Cloudinary", {
                  message: error.message,
                  stack: error.stack,
            });
            throw new AppError(
                  500,
                  "An Error has Occured: Failed to Establish Cloudinary Connection",
            );
      }
};
