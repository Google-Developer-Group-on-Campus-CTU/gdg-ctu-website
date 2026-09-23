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
      SiteContentRecord,
      updateSiteContent,
} from "./models/site-content.queries.js";
import {
      assertSectionKeyImmutable,
      SectionKey,
} from "./section-keys.js";
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

/** Direct DB row read — miss → null (404s stay fresh). */
const findSiteContentById = async (id: string): Promise<SiteContentRecord | null> => {
      const content = await getSiteContentById(id);
      return content ?? null;
};

export const createSiteContentService = async (
      data: CreateSiteContentDTO,
) => {
      // Fresh DB read so an existing row can never miss a 409.
      if (await getSiteContentBySectionKey(data.sectionKey)) {
            throw new AppError(409, "Site content sectionKey already exists");
      }

      await validateSiteContentReferences(data);

      const siteContent = await insertSiteContent({
            ...data,
            updatedAt: new Date(),
      });

      return siteContent;
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
      const content = await findSiteContentById(id);

      if (!content) {
            throw new AppError(404, "Site content not found");
      }

      return content;
};

export const getSiteContentBySectionKeyService = async (
      sectionKey: SectionKey,
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
      const content = await findSiteContentById(id);

      if (!content) {
            throw new AppError(404, "Site content not found");
      }

      // sectionKey is immutable (spec §4.7) — fixed keys, no renames.
      assertSectionKeyImmutable(content.sectionKey, data.sectionKey);

      await validateSiteContentReferences(data);

      const updated = await updateSiteContent(id, {
            ...data,
            updatedAt: new Date(),
      });

      return updated;
};

export const deleteSiteContentService = async (id: string) => {
      const content = await findSiteContentById(id);

      if (!content) {
            throw new AppError(404, "Site content not found");
      }

      await deleteSiteContent(id);
};
