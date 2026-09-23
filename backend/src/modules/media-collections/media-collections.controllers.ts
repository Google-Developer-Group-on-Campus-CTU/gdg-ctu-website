import { Request, Response } from "express";
import {
      getPagination,
      handleControllerError,
      validateBody,
      validateUuid,
} from "../../utils/http.js";
import {
      createMediaCollectionService,
      listMediaCollectionsService,
      getMediaCollectionService,
      updateMediaCollectionService,
      deleteMediaCollectionService,
} from "./media-collections.services.js";
import { CreateMediaCollectionSchema, UpdateMediaCollectionSchema } from "./media-collections.validations.js";

export const createMediaCollection = async (req: Request, res: Response) => {
      try {
            const data = validateBody(CreateMediaCollectionSchema, req.body);
            const collection = await createMediaCollectionService(data);
            return res.status(201).json({ success: true, collection });
      } catch (error) {
            return handleControllerError(res, error, "Failed to create media collection");
      }
};

export const listMediaCollections = async (req: Request, res: Response) => {
      try {
            const paginationQuery = getPagination(req.query);
            const result = await listMediaCollectionsService(paginationQuery);
            return res.status(200).json({ success: true, ...result });
      } catch (error) {
            return handleControllerError(res, error, "Failed to list media collections");
      }
};

export const getMediaCollection = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const collection = await getMediaCollectionService(id);
            return res.status(200).json({ success: true, collection });
      } catch (error) {
            return handleControllerError(res, error, "Failed to get media collection");
      }
};

export const updateMediaCollection = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const data = validateBody(UpdateMediaCollectionSchema, req.body);
            const collection = await updateMediaCollectionService(id, data);
            return res.status(200).json({ success: true, collection });
      } catch (error) {
            return handleControllerError(res, error, "Failed to update media collection");
      }
};

export const deleteMediaCollection = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            await deleteMediaCollectionService(id);
            return res.status(200).json({ success: true, message: "Media collection deleted" });
      } catch (error) {
            return handleControllerError(res, error, "Failed to delete media collection");
      }
};
