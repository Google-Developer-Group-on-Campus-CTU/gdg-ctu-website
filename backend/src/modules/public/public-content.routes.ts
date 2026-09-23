import { Router } from "express";
import { getActiveSiteContentList } from "../site-content/models/site-content.queries.js";
import { handleControllerError } from "../../utils/http.js";
import { pickMediaUrl, resolveMediaUrlMap } from "./public-media-url.js";

/**
 * Public site-content feed — no auth, active sections only.
 *
 * `GET /:sectionKey` was retired (architecture candidate 3): grep proved zero
 * backend internal callers, and the frontend public site deliberately reads
 * the list route and matches keys client-side (`frontend/src/api/public.js`).
 * Use `GET /` above and find the row by `sectionKey`.
 */
const router = Router();

router.get("/", async (_req, res) => {
      try {
            const content = await getActiveSiteContentList();
            const urlMap = await resolveMediaUrlMap(
                  content.map((c) => c.mediaId),
            );
            return res.status(200).json({
                  success: true,
                  content: content.map((section) => ({
                        ...section,
                        imageUrl: pickMediaUrl(urlMap, section.mediaId),
                  })),
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to list public content");
      }
});

export default router;
