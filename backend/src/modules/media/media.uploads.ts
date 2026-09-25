import { z } from "zod";
import { uploadMedia } from "../../config/cloudinary/cloudinary.services.js";
import { createMediaRecord } from "../../config/cloudinary/utils/cloudinary-media-data-helper.js";
import type { CloudinaryUploadResult } from "../../config/cloudinary/utils/cloudinary-rollback-helper.js";
import { rollbackCloudinaryUpload } from "../../config/cloudinary/utils/cloudinary-rollback-helper.js";
import { createMediaService } from "./media.services.js";

/**
 * Shared upload→media-record step (events / team-members /
 * partners create+update paths). Uploads the buffer to Cloudinary, then
 * persists the media row — DB-first ordering per step is the caller's job;
 * this helper only creates the new asset, it never deletes.
 *
 * Rollback ownership (split): this helper self-cleans its own step — if
 * `createMediaService` throws, the fresh asset is rolled back here (the
 * caller never receives `uploadResult` on failure, so its outer catch could
 * not fire). The caller keeps ownership for LATER entity inserts via the
 * returned `uploadResult` (`let uploadResult = ...; try { ... } catch {
 * rollback }`), using the shared `rollbackCloudinaryUpload` (which already
 * applies the `isCloudinaryDisabledError` semantics).
 */
const RecordUploadSchema = z.object({
      file: z.custom<Buffer>(
            (value) => Buffer.isBuffer(value),
            { message: "file must be a Buffer" },
      ),
      meta: z.object({
            folder: z.string().trim().min(1),
            uploadedBy: z.string().trim().min(1),
            resourceType: z
                  .enum(["image", "video", "raw", "auto"])
                  .default("image"),
      }),
});

// Input type (not output): `resourceType` carries a schema default, so it
// stays optional for callers — `parse` fills it before use.
export type RecordUploadInput = z.input<typeof RecordUploadSchema>;
export type RecordUploadMeta = RecordUploadInput["meta"];

export interface RecordedUpload {
      mediaId: string;
      uploadResult: CloudinaryUploadResult;
}

export const recordUpload = async (
      input: RecordUploadInput,
): Promise<RecordedUpload> => {
      const { file, meta } = RecordUploadSchema.parse(input);

      const uploadResult = await uploadMedia(file, {
            folder: meta.folder,
            resourceType: meta.resourceType,
      });
      try {
            const mediaRecord = await createMediaService(
                  createMediaRecord(uploadResult, meta.uploadedBy),
            );
            return { mediaId: mediaRecord.id, uploadResult };
      } catch (error) {
            // Self-clean this step: the caller never sees `uploadResult` on
            // failure, so its outer rollback cannot fire — roll back here.
            await rollbackCloudinaryUpload(uploadResult).catch(() => {});
            throw error;
      }
};
