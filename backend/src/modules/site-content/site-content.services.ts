import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import {
      clearCacheByPrefix,
      deleteCache,
      getCache,
      setCache,
} from "../../config/redis/redis.services.js";
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
      siteContentCacheKeys,
      SITE_CONTENT_CACHE_TTL,
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

/**
 * team-members cache rule: namespace `site-content:`, TTL 60 seconds. Every write
 * clears the whole prefix (admin list/byId/by-key + public list) and deletes
 * the by-id entry explicitly.
 */
const invalidateSiteContentCache = async (id?: string) => {
      await Promise.all([
            clearCacheByPrefix(siteContentCacheKeys.prefix),
            id ? deleteCache(siteContentCacheKeys.byId(id)) : Promise.resolve(),
      ]);
};

/** Cached admin row read — miss → DB (uncached misses, so 404s stay fresh). */
const findSiteContentById = async (id: string): Promise<SiteContentRecord | null> => {
      const cacheKey = siteContentCacheKeys.byId(id);
      const cached = await getCache<SiteContentRecord>(cacheKey);
      if (cached) return cached;

      const content = await getSiteContentById(id);
      if (content) {
            await setCache(cacheKey, content, SITE_CONTENT_CACHE_TTL);
      }
      return content ?? null;
};

export const createSiteContentService = async (
      data: CreateSiteContentDTO,
) => {
      // Fresh DB read (not the cache) so a stale entry can never fake a 409.
      if (await getSiteContentBySectionKey(data.sectionKey)) {
            throw new AppError(409, "Site content sectionKey already exists");
      }

      await validateSiteContentReferences(data);

      const siteContent = await insertSiteContent({
            ...data,
            updatedAt: new Date(),
      });

      await invalidateSiteContentCache(siteContent.id);
      return siteContent;
};

export const getSiteContentListService = async (pagination: Pagination) => {
      const cacheKey = siteContentCacheKeys.list(
            pagination.page,
            pagination.limit,
      );
      const cached = await getCache<{
            siteContent: SiteContentRecord[];
            pagination: ReturnType<typeof getPaginationMeta>;
      }>(cacheKey);
      if (cached) return cached;

      const [siteContent, total] = await Promise.all([
            getSiteContentList(pagination),
            countSiteContent(),
      ]);

      const res = {
            siteContent,
            pagination: getPaginationMeta(pagination, total),
      };

      await setCache(cacheKey, res, SITE_CONTENT_CACHE_TTL);
      return res;
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
      const cacheKey = siteContentCacheKeys.byKey(sectionKey);
      const cached = await getCache<SiteContentRecord>(cacheKey);
      if (cached) return cached;

      const content = await getSiteContentBySectionKey(sectionKey);

      if (!content) {
            throw new AppError(404, "Site content not found");
      }

      await setCache(cacheKey, content, SITE_CONTENT_CACHE_TTL);
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

      await invalidateSiteContentCache(id);
      return updated;
};

export const deleteSiteContentService = async (id: string) => {
      const content = await findSiteContentById(id);

      if (!content) {
            throw new AppError(404, "Site content not found");
      }

      await deleteSiteContent(id);
      await invalidateSiteContentCache(id);
};
