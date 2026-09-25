import { Request, Response } from "express";
import {
      getPagination,
      handleControllerError,
      validateBody,
      validateUuid,
      getStringParam,
} from "../../utils/http.js";
import {
      createGalleryCategoryService,
      deleteGalleryCategoryService,
      getGalleryCategoriesService,
      getGalleryCategoryByIdService,
      getGalleryCategoryBySlugService,
      updateGalleryCategoryService,
} from "./gallery-category.services.js";
import {
      CreateGalleryCategorySchema,
      UpdateGalleryCategorySchema,
} from "./gallery-category.validations.js";

export const createGalleryCategory = async (req: Request, res: Response) => {
      try {
            const data = validateBody(CreateGalleryCategorySchema, req.body);
            const category = await createGalleryCategoryService(data);
            return res.status(201).json({
                  success: true,
                  message: "Gallery category created successfully",
                  category,
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to create gallery category",
            );
      }
};

export const listGalleryCategories = async (req: Request, res: Response) => {
      try {
            const paginationQuery = getPagination(req.query);
            const { categories, pagination } =
                  await getGalleryCategoriesService(paginationQuery);
            return res
                  .status(200)
                  .json({ success: true, categories, pagination });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to list gallery categories",
            );
      }
};

export const getGalleryCategory = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const category = await getGalleryCategoryByIdService(id);
            return res.status(200).json({ success: true, category });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to get gallery category",
            );
      }
};

export const getGalleryCategoryBySlug = async (
      req: Request,
      res: Response,
) => {
      try {
            const slug = getStringParam(req.params.slug, "slug");
            const category = await getGalleryCategoryBySlugService(slug);
            return res.status(200).json({ success: true, category });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to get gallery category",
            );
      }
};

export const updateGalleryCategory = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            const data = validateBody(UpdateGalleryCategorySchema, req.body);
            const category = await updateGalleryCategoryService(id, data);
            return res.status(200).json({
                  success: true,
                  message: "Gallery category updated successfully",
                  category,
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to update gallery category",
            );
      }
};

export const removeGalleryCategory = async (req: Request, res: Response) => {
      try {
            const id = validateUuid(req.params.id);
            await deleteGalleryCategoryService(id);
            return res.status(200).json({
                  success: true,
                  message: "Gallery category deleted successfully",
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to delete gallery category",
            );
      }
};
