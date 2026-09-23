import { Router } from "express";
import {
      getActiveSiteContentBySectionKey,
      getActiveSiteContentList,
} from "../site-content/models/site-content.queries";
import { AppError, getStringParam, handleControllerError } from "../../utils/http";
import { pickMediaUrl, resolveMediaUrlMap } from "./public-media-url";

/** Public site-content feed — no auth, active sections only. */
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

router.get("/:sectionKey", async (req, res) => {
      try {
            const sectionKey = getStringParam(req.params.sectionKey, "sectionKey");
            const content = await getActiveSiteContentBySectionKey(sectionKey);
            if (!content) {
                  throw new AppError(404, "Content section not found");
            }
            const urlMap = await resolveMediaUrlMap([content.mediaId]);
            return res.status(200).json({
                  success: true,
                  content: {
                        ...content,
                        imageUrl: pickMediaUrl(urlMap, content.mediaId),
                  },
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to get public content");
      }
});

export default router;
