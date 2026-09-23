import { asc, count, eq } from "drizzle-orm";
import { db } from "../../../config/connectDB.js";
import { Pagination } from "../../../utils/pagination.js";
import { activeOnly } from "../../../utils/activeScope.js";
import { getCache, setCache } from "../../../config/redis/redis.services.js";
import {
      siteContentCacheKeys,
      SITE_CONTENT_CACHE_TTL,
} from "../section-keys.js";
import { siteContent } from "./site-content.js";

export type SiteContentRecord = typeof siteContent.$inferSelect;
export type NewSiteContentRecord = typeof siteContent.$inferInsert;

export const insertSiteContent = async (data: NewSiteContentRecord) => {
      const [content] = await db
            .insert(siteContent)
            .values(data)
            .returning();
      return content;
};

export const getSiteContentList = async (pagination: Pagination) =>
      db
            .select()
            .from(siteContent)
            .orderBy(asc(siteContent.sectionKey))
            .limit(pagination.limit)
            .offset(pagination.offset);

export const countSiteContent = async () => {
      const [result] = await db.select({ total: count() }).from(siteContent);
      return result.total;
};

export const getSiteContentById = async (id: string) => {
      const [content] = await db
            .select()
            .from(siteContent)
            .where(eq(siteContent.id, id));
      return content;
};

export const getSiteContentBySectionKey = async (sectionKey: string) => {
      const [content] = await db
            .select()
            .from(siteContent)
            .where(eq(siteContent.sectionKey, sectionKey));
      return content;
};

/**
 * Public feed: active sections only.
 *
 * Cached under `site-content:public:list` (team-members cache rule, TTL
 * 60 seconds); the admin services' `clearCacheByPrefix("site-content:")` on
 * create/update/delete invalidates it. The seam lives at this query boundary
 * because `public/public-content.routes.ts` is retirement-only in this slice.
 * Rows are JSON round-tripped, so `Date` fields come back as the exact ISO
 * strings `res.json(Date)` would have produced — wire shape unchanged.
 */
export const getActiveSiteContentList = async () => {
      const cacheKey = siteContentCacheKeys.publicList;
      const cached = await getCache<SiteContentRecord[]>(cacheKey);
      if (cached) return cached;

      const content = await db
            .select()
            .from(siteContent)
            .where(activeOnly(siteContent.isActive))
            .orderBy(asc(siteContent.sectionKey));

      await setCache(cacheKey, content, SITE_CONTENT_CACHE_TTL);
      return content;
};

export const updateSiteContent = async (
      id: string,
      data: Partial<NewSiteContentRecord>,
) => {
      const [content] = await db
            .update(siteContent)
            .set(data)
            .where(eq(siteContent.id, id))
            .returning();
      return content;
};

export const deleteSiteContent = async (id: string) => {
      const [content] = await db
            .delete(siteContent)
            .where(eq(siteContent.id, id))
            .returning();
      return content;
};
