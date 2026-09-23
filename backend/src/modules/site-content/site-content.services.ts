import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import { getMediaById } from "../media/models/media.queries.js";
import {
      countSiteContent,
      deleteSiteContent,
      getSiteContentById,
      getSiteContentBySectionKey,
      getSiteContentList,
      insertSiteContent,
      updateSiteContent,
} from "./models/site-content.queries.js";
import {
      CreateSiteContentDTO,
      UpdateSiteContentDTO,
} from "./site-content.validations.js";

const validateSiteContentReferences = async (
      data: Partial<Pick<CreateSiteContentDTO, "updatedBy" | "mediaId">>,
) => {
      // Tolerant updatedBy: a valid user ID string never 400s here. The normal
      // flow (POST /auth/sync first) guarantees the admin row exists and the
      // DB foreign key remains the final guard for truly invalid references.
      if (data.mediaId && !(await getMediaById(data.mediaId))) {
            throw new AppError(400, "mediaId must reference existing media");
      }
};

export const createSiteContentService = async (
      data: CreateSiteContentDTO,
) => {
      if (await getSiteContentBySectionKey(data.sectionKey)) {
            throw new AppError(409, "Site content sectionKey already exists");
      }

      await validateSiteContentReferences(data);

      return insertSiteContent({
            ...data,
            updatedAt: new Date(),
      });
};

export const getSiteContentListService = async (pagination: Pagination) => {
      const [siteContent, total] = await Promise.all([
            getSiteContentList(pagination),
            countSiteContent(),
      ]);

      return {
            siteContent,
            pagination: getPaginationMeta(pagination, total),
      };
};

export const getSiteContentByIdService = async (id: string) => {
      const content = await getSiteContentById(id);

      if (!content) {
            throw new AppError(404, "Site content not found");
      }

      return content;
};

export const getSiteContentBySectionKeyService = async (
      sectionKey: string,
) => {
      const content = await getSiteContentBySectionKey(sectionKey);

      if (!content) {
            throw new AppError(404, "Site content not found");
      }

      return content;
};

export const updateSiteContentService = async (
      id: string,
      data: UpdateSiteContentDTO,
) => {
      const content = await getSiteContentById(id);

      if (!content) {
            throw new AppError(404, "Site content not found");
      }

      if (data.sectionKey && data.sectionKey !== content.sectionKey) {
            // sectionKey is immutable (spec §4.7) — fixed keys, no renames.
            throw new AppError(
                  400,
                  "sectionKey is immutable and cannot be changed",
            );
      }

      await validateSiteContentReferences(data);

      return updateSiteContent(id, {
            ...data,
            updatedAt: new Date(),
      });
};

export const deleteSiteContentService = async (id: string) => {
      const content = await getSiteContentById(id);

      if (!content) {
            throw new AppError(404, "Site content not found");
      }

      await deleteSiteContent(id);
};
