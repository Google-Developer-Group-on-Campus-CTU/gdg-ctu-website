import { Request, Response } from "express";
import type { UploadApiResponse } from "cloudinary";
import {
      getPagination,
      handleControllerError,
      validateBody,
      validateUuid,
      AppError,
} from "../../utils/http.js";
import upload from "../../middleware/upload.js";
import {
      createMediaService,
      getMediaService,
      getMediaByIdService,
      updateMediaService,
      deleteMediaService,
} from "./media.services.js";
import { CreateMediaSchema, UpdateMediaSchema } from "./media.validations.js";
import {
      uploadMedia,
      deleteMediaCloudinaryService,
} from "../../config/cloudinary/cloudinary.services.js";
import { rollbackCloudinaryUpload } from "../../config/cloudinary/utils/cloudinary-rollback-helper.js";
import logger from "../../utils/logger.js";

export const createMedia = async (req: Request, res: Response) => {
      try {
            // Validate non‑file fields (uploadedBy, altText)
            const data = validateBody(CreateMediaSchema, req.body);

            const file = (req as any).file;
            if (!file) {
                  return res
                        .status(400)
                        .json({ success: false, message: "File is required" });
            }

            const uploadResult = await uploadMedia(file.buffer, {
                  folder: "media",
                  resourceType: "auto",
            });

            const mediaData = {
                  uploadedBy: data.uploadedBy,
                  altText: data.altText ?? null,
                  cloudinaryAssetId: uploadResult.asset_id,
                  publicId: uploadResult.public_id,
                  secureUrl: uploadResult.secure_url,
                  resourceType: uploadResult.resource_type,
                  format: uploadResult.format,
                  width: uploadResult.width,
                  height: uploadResult.height,
                  bytes: uploadResult.bytes,
                  originalFilename: uploadResult.original_filename,
            };

            const media = await createMediaService(mediaData as any);
            return res.status(201).json({
                  success: true,
                  message: "Media created successfully",
                  media,
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to create media");
      }
};

export const listMedia = async (req: Request, res: Response) => {
      try {
            const paginationQuery = getPagination(req.query);
            const { media, pagination } =
                  await getMediaService(paginationQuery);
            return res.status(200).json({ success: true, media, pagination });
      } catch (error) {
            return handleControllerError(res, error, "Failed to list media");
      }
};

export const getMedia = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const media = await getMediaByIdService(id);
            return res.status(200).json({ success: true, media });
      } catch (error) {
            return handleControllerError(res, error, "Failed to get media");
      }
};

export const updateMedia = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const file = (req as any).file;

            // Body is optional when a replacement file is supplied (multipart).
            const hasBody = Boolean(
                  req.body && Object.keys(req.body).length > 0,
            );
            const data = hasBody
                  ? validateBody(UpdateMediaSchema, req.body)
                  : ({} as any);

            if (!hasBody && !file) {
                  throw new AppError(
                        400,
                        "At least one field or file is required",
                  );
            }

            // Resolve the existing record so the replaced Cloudinary asset can
            // be cleaned up after a successful swap (also yields 404 when missing).
            const existing = await getMediaByIdService(id);

            let uploadResult: UploadApiResponse | null = null;
            try {
                  let cloudinaryUpdate: Record<string, unknown> = {};
                  if (file) {
                        uploadResult = await uploadMedia(file.buffer, {
                              folder: "media",
                              resourceType: "auto",
                        });
                        cloudinaryUpdate = {
                              cloudinaryAssetId: uploadResult.asset_id,
                              publicId: uploadResult.public_id,
                              secureUrl: uploadResult.secure_url,
                              resourceType: uploadResult.resource_type,
                              format: uploadResult.format,
                              width: uploadResult.width,
                              height: uploadResult.height,
                              bytes: uploadResult.bytes,
                              originalFilename: uploadResult.original_filename,
                        };
                  }

                  const media = await updateMediaService(id, {
                        ...data,
                        ...cloudinaryUpdate,
                  } as any);

                  // Best-effort cleanup of the replaced Cloudinary asset.
                  if (file && existing.publicId) {
                        try {
                              await deleteMediaCloudinaryService(
                                    existing.publicId,
                                    existing.resourceType as
                                          | "image"
                                          | "video"
                                          | "raw",
                              );
                        } catch (cleanupError: any) {
                              if (
                                    (cleanupError instanceof AppError &&
                                          cleanupError.statusCode === 503) ||
                                    (typeof cleanupError?.message ===
                                          "string" &&
                                          cleanupError.message.includes(
                                                "not configured",
                                          ))
                              ) {
                                    logger.warn(
                                          "Cloudinary disabled - skipping old media asset cleanup",
                                    );
                              } else {
                                    logger.error(
                                          "Failed to delete replaced Cloudinary asset",
                                          {
                                                publicId: existing.publicId,
                                                message:
                                                      cleanupError.message,
                                          },
                                    );
                              }
                        }
                  }

                  return res.status(200).json({
                        success: true,
                        message: "Media updated successfully",
                        media,
                  });
            } catch (uploadError) {
                  // Roll back the new Cloudinary upload when the DB update fails.
                  if (uploadResult) {
                        await rollbackCloudinaryUpload(uploadResult);
                  }
                  throw uploadError;
            }
      } catch (error) {
            return handleControllerError(res, error, "Failed to update media");
      }
};

export const removeMedia = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            await deleteMediaService(id);
            return res.status(200).json({
                  success: true,
                  message: "Media deleted successfully",
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to delete media");
      }
};
