// backend/src/config/cloudinary/cloudinary.services.ts
import { UploadApiOptions, UploadApiResponse } from "cloudinary";
import cloudinary, { isCloudinaryEnabled } from "./cloudinary.config";
import { AppError } from "../../utils/http";
import { createMediaRecord } from "./utils/cloudinary-media-data-helper";
import { insertBulkMediaService } from "../../modules/media/media.services";

/**
 * Cloudinary upload service.
 *
 * All uploads are stored under the **root folder** `GDGoC`. Callers can supply a
 * *sub‑folder* (e.g. `events`, `team-members`, `partners`). The final Cloudinary
 * path becomes `GDGoC/<sub‑folder>`.
 *
 * If the `folder` option is omitted the asset lands directly in the root folder.
 */
export interface UploadMediaOptions {
      /** Target sub‑folder (relative to the Cloudinary root). */
      folder?: string;
      /** Optional explicit public ID for the uploaded asset. */
      publicId?: string;
      /** Resource type – image, video, raw or auto. */
      resourceType?: "image" | "video" | "raw" | "auto";
}

/**
 * Upload a binary buffer to Cloudinary.
 *
 * The function is a thin wrapper around `cloudinary.uploader.upload_stream`.
 * It validates that Cloudinary is enabled, builds the upload options,
 * and returns a promise that resolves with Cloudinary’s response.
 *
 * @param buffer  – The binary content (e.g. image file) to upload.
 * @param options – Configuration for the upload; `folder` is dynamic.
 *
 * @throws AppError(503) when Cloudinary is not configured.
 * @throws AppError(500) / AppError(404) for upload‑stream errors.
 *
 * @returns Cloudinary `UploadApiResponse` containing the asset URL, public ID, etc.
 *
 * Example use case:
 * await uploadMedia(fileBuffer, {
 *    folder: "partners",
 *    resourceType: "image",
 * })
 *
 * Another Example:
 * await uploadMedia(imageBuffer, {
 *    folder: "events",
 * });
 */
export async function uploadMedia(
      buffer: Buffer,
      options: UploadMediaOptions,
): Promise<UploadApiResponse> {
      if (!isCloudinaryEnabled()) {
            throw new AppError(
                  503,
                  "Media service unavailable: Cloudinary is not configured",
            );
      }

      return new Promise((resolve, reject) => {
            // ------------------------------------------------------------
            // Resolve the destination folder.
            // If the caller didn't provide one, use the historic root folder.
            // ------------------------------------------------------------
            const targetFolder = options.folder
                  ? `GDGoC/${options.folder}`
                  : "GDGoC";

            const uploadOptions: UploadApiOptions = {
                  folder: targetFolder,
                  public_id: options.publicId,
                  resource_type: options.resourceType ?? "auto",
            };

            // ------------------------------------------------------------
            // Create the upload stream – Cloudinary writes the buffer into it.
            // ------------------------------------------------------------
            const uploadStream = cloudinary.uploader.upload_stream(
                  uploadOptions,
                  (error, result) => {
                        if (error) {
                              // Propagate the error so callers can handle it.
                              reject(error);
                              return new AppError(500, "An Error has Occurred");
                        }

                        if (!result) {
                              reject(
                                    new AppError(
                                          404,
                                          "Cloudinary upload returned no result",
                                    ),
                              );
                              return;
                        }

                        resolve(result);
                  },
            );

            // Push the buffer into the stream and close it.
            uploadStream.end(buffer);
      });
}

/**
 * Handles bulk Cloudinary uploads and local DB metadata storage.
 * @returns Array of local database UUIDs/IDs for the uploaded media.
 */
interface BulkUploadOptions {
      files: Express.Multer.File[];
      folderPath: string; // e.g., "teams/galleries" (will prepend GDGoC/ automatically via uploadMedia)
      uploadedBy: string; // User ID performing the action
}

export const processBulkMediaUpload = async ({
      files,
      folderPath,
      uploadedBy,
}: BulkUploadOptions): Promise<string[]> => {
      if (!files || !files.length) {
            throw new AppError(
                  400,
                  "Files not found, cannot proceed to bulk upload",
            );
      }

      // Upload all files concurrently to cloudinary
      const uploadPromises = files.map((file) =>
            uploadMedia(file.buffer, {
                  folder: `GDGoC/${folderPath}` || `GDGoC`,
                  resourceType: "image",
            }),
      );

      const cloudinaryResults = await Promise.all(uploadPromises);

      // Map cloudinary results to the NewMediaRecord DTO
      const mediaRecordsToInsert = cloudinaryResults.map((result) =>
            createMediaRecord(result, uploadedBy),
      );

      // Store metadata to local DB
      const savedMediaRecords =
            await insertBulkMediaService(mediaRecordsToInsert);

      // Return the local database IDs for referencing
      return savedMediaRecords.map((record) => record.id);
};

/**
 * Delete a Cloudinary asset by its public ID.
 *
 * @param publicId      – The Cloudinary public ID (full path without extension).
 * @param resourceType  – The type of the asset; defaults to `"image"`.
 *
 * @throws AppError(503) when Cloudinary is not configured.
 *
 * @returns The Cloudinary destroy response promise.
 */
export async function deleteMediaCloudinaryService(
      publicId: string,
      resourceType: "image" | "video" | "raw" = "image",
) {
      if (!isCloudinaryEnabled()) {
            throw new AppError(
                  503,
                  "Media service unavailable: Cloudinary is not configured",
            );
      }

      return cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType,
      });
}
