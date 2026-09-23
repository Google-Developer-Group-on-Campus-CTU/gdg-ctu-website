import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import { getAdminById } from "../admins/models/admin.queries.js";
import { getMediaById } from "../media/models/media.queries.js";
import {
      insertMediaCollection,
      getMediaCollections,
      countMediaCollections,
      getMediaCollectionById,
      getMediaCollectionBySlug,
      updateMediaCollection,
      deleteMediaCollection,
} from "./models/media-collection.queries.js";
import {
      CreateMediaCollectionDTO,
      MediaCollectionRecord,
      UpdateMediaCollectionDTO,
} from "./media-collections.validations.js";

export const toMediaCollectionResponse = (col: MediaCollectionRecord) => col; // no sensitive fields

export const createMediaCollectionService = async (
      data: CreateMediaCollectionDTO,
) => {
      // Read-level slug 409 — matches events/team/partners/site-content (slug
      // is unique in the DB, but this returns a clean 409 instead of a raw
      // constraint error).
      if (await getMediaCollectionBySlug(data.slug)) {
            throw new AppError(409, "Album slug already exists");
      }
      if (!(await getAdminById(data.createdBy))) {
            throw new AppError(
                  400,
                  "createdBy must reference an existing admin",
            );
      }
      if (data.coverMediaId && !(await getMediaById(data.coverMediaId))) {
            throw new AppError(
                  400,
                  "coverMediaId must reference existing media",
            );
      }

      const col = await insertMediaCollection(data);

      return toMediaCollectionResponse(col);
};

export const listMediaCollectionsService = async (pagination: Pagination) => {
      const [collections, total] = await Promise.all([
            getMediaCollections(pagination),
            countMediaCollections(),
      ]);

      return {
            collections: collections.map(toMediaCollectionResponse),
            pagination: getPaginationMeta(pagination, total),
      };
};

export const getMediaCollectionService = async (id: string) => {
      const col = await getMediaCollectionById(id);
      if (!col) {
            throw new AppError(404, "Media collection not found");
      }

      return toMediaCollectionResponse(col);
};

export const updateMediaCollectionService = async (
      id: string,
      data: UpdateMediaCollectionDTO,
) => {
      const existing = await getMediaCollectionById(id);
      if (!existing) {
            throw new AppError(404, "Media collection not found");
      }

      if (data.slug && data.slug !== existing.slug) {
            const slugOwner = await getMediaCollectionBySlug(data.slug);
            if (slugOwner) {
                  throw new AppError(409, "Album slug already exists");
            }
      }

      if (data.createdBy && !(await getAdminById(data.createdBy))) {
            throw new AppError(
                  400,
                  "createdBy must reference an existing admin",
            );
      }

      if (data.coverMediaId && !(await getMediaById(data.coverMediaId))) {
            throw new AppError(
                  400,
                  "coverMediaId must reference existing media",
            );
      }

      const updated = await updateMediaCollection(id, data);

      return toMediaCollectionResponse(updated);
};

export const deleteMediaCollectionService = async (id: string) => {
      const existing = await getMediaCollectionById(id);
      if (!existing) {
            throw new AppError(404, "Media collection not found");
      }
      
      // Optional: could check for items referencing collection before delete
      await deleteMediaCollection(id);
};
