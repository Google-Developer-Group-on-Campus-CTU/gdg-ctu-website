import { Request, Response } from "express";
import {
      getPagination,
      handleControllerError,
      validateBody,
      validateUuid,
} from "../../utils/http";
import { validateParams } from "../../middleware/validateParams";
import {
      createMediaCollectionItemService,
      listMediaCollectionItemsService,
      getMediaCollectionItemService,
      updateMediaCollectionItemService,
      deleteMediaCollectionItemService,
} from "./media-collection-items.services";
import {
      CreateMediaCollectionItemSchema,
      UpdateMediaCollectionItemSchema,
} from "./media-collection-items.validations";

export const createMediaCollectionItem = async (
      req: Request,
      res: Response,
) => {
      try {
            const data = validateBody(
                  CreateMediaCollectionItemSchema,
                  req.body,
            );
            const item = await createMediaCollectionItemService(data);
            return res.status(201).json({ success: true, item });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to create media collection item",
            );
      }
};

export const listMediaCollectionItems = async (req: Request, res: Response) => {
      try {
            const paginationQuery = getPagination(req.query);
            const result =
                  await listMediaCollectionItemsService(paginationQuery);
            return res.status(200).json({ success: true, ...result });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to list media collection items",
            );
      }
};

export const getMediaCollectionItem = async (req: Request, res: Response) => {
      try {
            const { collectionId, mediaId } = req.params;
            const collectionUuid = validateUuid(collectionId);
            const mediaUuid = validateUuid(mediaId);
            const item = await getMediaCollectionItemService(
                  collectionUuid,
                  mediaUuid,
            );
            return res.status(200).json({ success: true, item });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to get media collection item",
            );
      }
};

export const updateMediaCollectionItem = async (
      req: Request,
      res: Response,
) => {
      try {
            const { collectionId, mediaId } = req.params;
            const collectionUuid = validateUuid(collectionId, "collectionId");
            const mediaUuid = validateUuid(mediaId, "mediaId");
            const data = validateBody(UpdateMediaCollectionItemSchema, req.body);
            const item = await updateMediaCollectionItemService(
                  collectionUuid,
                  mediaUuid,
                  data,
            );
            return res.status(200).json({ success: true, item });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to update media collection item",
            );
      }
};

export const deleteMediaCollectionItem = async (
      req: Request,
      res: Response,
) => {
      try {
            const { collectionId, mediaId } = req.params;
            const collectionUuid = validateUuid(collectionId);
            const mediaUuid = validateUuid(mediaId);
            await deleteMediaCollectionItemService(collectionUuid, mediaUuid);
            return res.status(200).json({
                  success: true,
                  message: "Media collection item deleted",
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to delete media collection item",
            );
      }
};
