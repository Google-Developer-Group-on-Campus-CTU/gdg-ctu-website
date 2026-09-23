import { Request, Response } from "express";
import {
      AppError,
      getPagination,
      handleControllerError,
      validateBody,
      validateUuid,
} from "../../utils/http";
import {
      createMediaCollectionService,
      listMediaCollectionsService,
      getMediaCollectionService,
      updateMediaCollectionService,
      deleteMediaCollectionService,
} from "./media-collections.services";
import {
      CreateMediaCollectionSchema,
      UpdateMediaCollectionSchema,
} from "./media-collections.validations";
import { getClerkIdFromRequest } from "../auth/auth.utils";
import logger from "../../utils/logger";

export const createMediaCollection = async (req: Request, res: Response) => {
      try {
            const clerkId = getClerkIdFromRequest(req);
            if (!clerkId) {
                  throw new AppError(
                        401,
                        "Unable to determine uploader (Clerk ID) for image upload",
                  );
            }

            // Shape of req.files
            const uploadedFiles = req.files as {
                  [fieldname: string]: Express.Multer.File[];
            };

            // Extract type of files safely
            const coverImageFile = uploadedFiles["collectionCoverImage"]?.[0]; // Get the 1st item of the cover array
            const imageCollections = uploadedFiles["imageCollections"] || []; // Get the bulk array

            // extract the buffer of the media collection cover image
            const collectionCoverImageBuffer = coverImageFile?.buffer;

            const mediaCollectionJson = req.body.mediaCollection;
            if (!mediaCollectionJson) {
                  throw new AppError(
                        400,
                        "`media-collection` JSON payload missing",
                  );
            }

            const rawMediaCollection = JSON.parse(mediaCollectionJson);
            rawMediaCollection.createdBy = clerkId;

            const mediaCollectionData =
                  CreateMediaCollectionSchema.parse(rawMediaCollection);

            const collection = await createMediaCollectionService(
                  collectionCoverImageBuffer,
                  imageCollections,
                  mediaCollectionData,
            );

            return res.status(201).json({
                  success: true,
                  message: `Media Collection '${collection.name}' created succesfully`,
                  collection,
            });
      } catch (error: any) {
            logger.error("Failed to create media collection", {
                  message: error.message,
                  stack: error.stack,
            });

            return handleControllerError(
                  res,
                  error,
                  "Failed to create media collection",
            );
      }
};

export const listMediaCollections = async (req: Request, res: Response) => {
      try {
            const paginationQuery = getPagination(req.query);
            const result = await listMediaCollectionsService(paginationQuery);
            return res.status(200).json({ success: true, ...result });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to list media collections",
            );
      }
};

export const getMediaCollection = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const collection = await getMediaCollectionService(id);
            return res.status(200).json({ success: true, collection });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to get media collection",
            );
      }
};

export const updateMediaCollection = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            // Grab multipart fields
            const uploadedFiles = req.files as {
                  [fieldname: string]: Express.Multer.File[];
            };

            const newImageFiles = uploadedFiles["imageCollectionsAdd"] || [];
            // Helper to safely parse JSON fields that may already be objects
            const safeParse = (value: any) => {
                  if (!value) return undefined;
                  if (typeof value === "object") return value;
                  try {
                        return JSON.parse(value);
                  } catch (e) {
                        // If parsing fails, log and treat as undefined
                        logger.error("Failed to parse JSON field", {
                              fieldValue: value,
                              error: e,
                        });
                        return undefined;
                  }
            };

            const removeMediaIdsRaw = req.body.removeMediaIds;
            const parsedRemoveIds = safeParse(removeMediaIdsRaw);
            const removeMediaIds: string[] = Array.isArray(parsedRemoveIds)
                  ? parsedRemoveIds
                  : [];

            // Metadata may be sent as a JSON string in a field called "mediaCollection"
            const mediaCollectionJson = req.body.mediaCollection;
            const parsedMediaCollection = safeParse(mediaCollectionJson);
            const data = parsedMediaCollection
                  ? UpdateMediaCollectionSchema.parse(
                          parsedMediaCollection as any,
                    )
                  : {};

            const collection = await updateMediaCollectionService(
                  id,
                  data,
                  removeMediaIds,
                  newImageFiles,
            );

            return res.status(200).json({ success: true, collection });
      } catch (error: any) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to update media collection",
            );
      }
};

export const deleteMediaCollection = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            await deleteMediaCollectionService(id);
            return res
                  .status(200)
                  .json({ success: true, message: "Media collection deleted" });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to delete media collection",
            );
      }
};
