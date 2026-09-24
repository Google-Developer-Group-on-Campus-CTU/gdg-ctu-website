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
import { CreateMediaSchema, UpdateMediaSchema, SignUploadSchema, CreateMediaInput, UpdateMediaInput } from "./media.validations.js";
import { getUserIdFromRequest } from "../auth/auth.utils.js";
import {
      uploadMedia,
      deleteMediaCloudinaryService,
      signDirectUpload,
} from "../../config/cloudinary/cloudinary.services.js";
import {
      rollbackCloudinaryUpload,
      isCloudinaryDisabledError,
} from "../../config/cloudinary/utils/cloudinary-rollback-helper.js";
import logger from "../../utils/logger.js";

export const createMedia = async (req: Request, res: Response) => {
      try {
            // The session is the actor — a client-supplied `uploadedBy` is
            // never trusted (spoofing it would attribute uploads to anyone).
            const userId = getUserIdFromRequest(req);
            if (!userId) {
                  throw new AppError(401, "Unauthorized: missing user ID");
            }

            // Validate non‑file fields (altText); strip any `uploadedBy`.
            const { uploadedBy: _ignoredUploadedBy, ...rest } = req.body ?? {};
            const data = validateBody(
                  CreateMediaSchema.omit({ uploadedBy: true }),
                  rest,
            );

            const file = (req as any).file;
            if (!file) {
                  return res
                        .status(400)
                        .json({ success: false, message: "File is required" });
            }

            let trackedUpload: UploadApiResponse | null = null;
            try {
                  trackedUpload = await uploadMedia(file.buffer, {
                        folder: "media",
                        resourceType: "auto",
                  });

                  const mediaData: CreateMediaInput = {
                        uploadedBy: userId,
                        altText: data.altText ?? null,
                        cloudinaryAssetId: trackedUpload.asset_id,
                        publicId: trackedUpload.public_id,
                        secureUrl: trackedUpload.secure_url,
                        resourceType: trackedUpload.resource_type,
                        format: trackedUpload.format ?? null,
                        width: trackedUpload.width ?? null,
                        height: trackedUpload.height ?? null,
                        bytes: trackedUpload.bytes ?? null,
                        originalFilename:
                              trackedUpload.original_filename ?? null,
                  };

                  const media = await createMediaService(mediaData);
                  return res.status(201).json({
                        success: true,
                        message: "Media created successfully",
                        media,
                  });
            } catch (createError) {
                  // Roll back the Cloudinary upload when the DB insert fails
                  // (same pattern as updateMedia) — no orphaned assets.
                  if (trackedUpload) {
                        await rollbackCloudinaryUpload(trackedUpload);
                  }
                  throw createError;
            }
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
            // File-only updates parse an empty partial through Zod instead
            // of casting — the non-empty refine lives only on
            // UpdateMediaSchema, so `{}` stays valid here.
            const data: UpdateMediaInput = hasBody
                  ? validateBody(UpdateMediaSchema, req.body)
                  : CreateMediaSchema.partial().parse({});

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
                  let cloudinaryUpdate: Partial<CreateMediaInput> = {};
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
                              format: uploadResult.format ?? null,
                              width: uploadResult.width ?? null,
                              height: uploadResult.height ?? null,
                              bytes: uploadResult.bytes ?? null,
                              originalFilename:
                                    uploadResult.original_filename ?? null,
                        };
                  }

                  const media = await updateMediaService(id, {
                        ...data,
                        ...cloudinaryUpdate,
                  });

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
                              if (isCloudinaryDisabledError(cleanupError)) {
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

/**
 * Sign a client-direct-to-Cloudinary upload (POST /media/sign-upload).
 * Returns signed params only — the client then POSTs the file bytes
 * straight to Cloudinary, so bulk uploads never pass through this
 * serverless function (Hobby 4.5MB request cap). Session-authenticated
 * via the protected /media mount.
 */
export const signUpload = (req: Request, res: Response) => {
      try {
            const data = validateBody(SignUploadSchema, req.body ?? {});
            const signed = signDirectUpload({
                  folder: data.folder,
                  publicId: data.publicId,
                  resourceType: data.resourceType,
            });
            return res.status(200).json({ success: true, upload: signed });
      } catch (error) {
            return handleControllerError(res, error, "Failed to sign upload");
      }
};
