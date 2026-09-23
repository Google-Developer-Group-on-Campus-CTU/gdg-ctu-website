import { deleteMediaService } from "../modules/media/media.services.js";
import { mediaHasReferences } from "../modules/media/models/media.queries.js";
import { AppError } from "./http.js";

/**
 * Safely removes an old media asset from both cloud storage (Cloudinary) and the database
 * when it is replaced during an update operation.
 *
 * This function includes a safety check to ensure the old media is not deleted if it is
 * still being referenced by other records (e.g., shared images or polymorphic relations).
 *
 * @param oldMediaId - The unique identifier of the old media record to be evaluated.
 * @param newMediaId - The unique identifier of the newly assigned media record.
 * @returns {Promise<void>} Resolves when the cleanup completes or is successfully bypassed.
 *
 * @example
 * // Typical usage inside an update service or controller:
 * const newAvatarId = req.body.avatarId;
 * const currentUser = await getUserById(userId);
 *
 * // 1. Update the user record with the new media ID
 * await updateUserService(userId, { avatarId: newAvatarId });
 *
 * // 2. Fire the cleanup utility for the replaced media
 * await cleanupReplacedMedia(currentUser.avatarId, newAvatarId);
 */
export const cleanupReplacedMedia = async (
      oldMediaId?: string | null,
      newMediaId?: string | null,
): Promise<void> => {
      // Guard: Exit if there is no old media, or if the media hasn't actually changed
      if (!oldMediaId || oldMediaId === newMediaId) {
            return;
      }

      // Guard: Exit if the old media is still referenced by other records
      const hasRefs = await mediaHasReferences(oldMediaId);
      if (hasRefs) {
            return;
      }

      try {
            // Execute the deletion from Cloudinary first, then the database
            await deleteMediaService(oldMediaId);
      } catch (error: any) {
            // Log the error for observability in production environments
            console.error(
                  `[cleanupReplacedMedia] Failed to delete orphaned media ${oldMediaId}:`,
                  error,
            );
            throw new AppError(
                  500,
                  `[cleanupReplacedMedia] Failed to delete orphaned media ${oldMediaId}:`,
            );
      }
};
