import { Router } from "express";
import { getPublicPartnersService } from "../partners/partner.services.js";
import { handleControllerError } from "../../utils/http.js";
import { pickMediaUrl, resolveMediaUrlMap } from "./public-media-url.js";

/** Public partners feed — no auth, active only, tier-ordered. */
const router = Router();

router.get("/", async (_req, res) => {
      try {
            const partners = await getPublicPartnersService();
            const urlMap = await resolveMediaUrlMap(
                  partners.map((p) => p.logoMediaId),
            );
            return res.status(200).json({
                  success: true,
                  partners: partners.map((partner) => ({
                        ...partner,
                        logoUrl: pickMediaUrl(urlMap, partner.logoMediaId),
                  })),
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to list public partners");
      }
});

export default router;
