import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import {
      countGalleryCategories,
      deleteGalleryCategory,
      getGalleryCategories,
      getGalleryCategoryById,
      getGalleryCategoryBySlug,
      insertGalleryCategory,
      updateGalleryCategory,
} from "./models/gallery-category.queries.js";
import {
      CreateGalleryCategoryDTO,
      UpdateGalleryCategoryDTO,
} from "./gallery-category.validations.js";

export const createGalleryCategoryService = async (
      data: CreateGalleryCategoryDTO,
) => {
      if (await getGalleryCategoryBySlug(data.slug)) {
            throw new AppError(409, "Gallery category slug already exists");
      }
      return insertGalleryCategory(data);
};

export const getGalleryCategoriesService = async (pagination: Pagination) => {
      const [categories, total] = await Promise.all([
            getGalleryCategories(pagination),
            countGalleryCategories(),
      ]);
      return {
            categories,
            pagination: getPaginationMeta(pagination, total),
      };
};

export const getGalleryCategoryByIdService = async (id: string) => {
      const category = await getGalleryCategoryById(id);
      if (!category) {
            throw new AppError(404, "Gallery category not found");
      }
      return category;
};

export const getGalleryCategoryBySlugService = async (slug: string) => {
      const category = await getGalleryCategoryBySlug(slug);
      if (!category) {
            throw new AppError(404, "Gallery category not found");
      }
      return category;
};

export const updateGalleryCategoryService = async (
      id: string,
      data: UpdateGalleryCategoryDTO,
) => {
      const category = await getGalleryCategoryById(id);
      if (!category) {
            throw new AppError(404, "Gallery category not found");
      }
      if (data.slug && data.slug !== category.slug) {
            const existing = await getGalleryCategoryBySlug(data.slug);
            if (existing) {
                  throw new AppError(
                        409,
                        "Gallery category slug already exists",
                  );
            }
      }
      return updateGalleryCategory(id, { ...data, updatedAt: new Date() });
};

export const deleteGalleryCategoryService = async (id: string) => {
      const category = await getGalleryCategoryById(id);
      if (!category) {
            throw new AppError(404, "Gallery category not found");
      }
      await deleteGalleryCategory(id);
};
