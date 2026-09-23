import { Router } from "express";
import {
      getActiveMediaCollectionBySlug,
      getActiveMediaCollections,
} from "../media-collections/models/media-collection.queries";
import {
      getFeaturedCollectionItems,
      getItemsByCollectionId,
} from "../media-collection-items/models/media-collection-item.queries";
import { AppError, getStringParam, handleControllerError } from "../../utils/http";
import { pickMediaUrl, resolveMediaUrlMap } from "./public-media-url";

/**
 * Public gallery feed — no auth, active albums only, items ordered.
 * Featured strip capped at 8 (spec §4.6/§5).
 */
const router = Router();

const MAX_FEATURED = 8;

const toPublicPhoto = (r: {
      albumSlug: string;
      albumTitle: string;
      imageUrl: string;
      itemAlt: string | null;
      mediaAlt: string | null;
      caption: string | null;
      order: number | null;
}) => ({
      albumSlug: r.albumSlug,
      albumTitle: r.albumTitle,
      imageUrl: r.imageUrl,
      alt: r.itemAlt ?? r.mediaAlt ?? r.caption ?? "",
      caption: r.caption,
      order: r.order ?? 0,
});

router.get("/albums", async (_req, res) => {
      try {
            const albums = await getActiveMediaCollections();
            const urlMap = await resolveMediaUrlMap(
                  albums.map((a) => a.coverMediaId),
            );
            return res.status(200).json({
                  success: true,
                  albums: albums.map((album) => ({
                        ...album,
                        coverUrl: pickMediaUrl(urlMap, album.coverMediaId),
                  })),
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to list public albums");
      }
});

router.get("/albums/slug/:slug", async (req, res) => {
      try {
            const slug = getStringParam(req.params.slug, "slug");
            const album = await getActiveMediaCollectionBySlug(slug);
            if (!album) {
                  throw new AppError(404, "Album not found");
            }
            const items = await getItemsByCollectionId(album.id);
            const urlMap = await resolveMediaUrlMap([
                  album.coverMediaId,
                  ...items.map((i) => i.mediaId),
            ]);
            return res.status(200).json({
                  success: true,
                  album: {
                        ...album,
                        coverUrl: pickMediaUrl(urlMap, album.coverMediaId),
                  },
                  items: items.map((item) => ({
                        ...item,
                        secureUrl: pickMediaUrl(urlMap, item.mediaId),
                  })),
            });
      } catch (error) {
            return handleControllerError(res, error, "Failed to get public album");
      }
});

router.get("/featured", async (req, res) => {
      try {
            const requested = Number(req.query.limit ?? 8);
            const limit = Number.isFinite(requested)
                  ? Math.min(Math.max(requested, 1), MAX_FEATURED)
                  : 8;
            const photos = await getFeaturedCollectionItems(limit);
            return res
                  .status(200)
                  .json({ success: true, photos: photos.map(toPublicPhoto) });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to list featured photos",
            );
      }
});

export default router;
