import { Router } from "express";
import {
      createMediaCollectionItem,
      listMediaCollectionItems,
      getMediaCollectionItem,
      updateMediaCollectionItem,
      deleteMediaCollectionItem,
} from "./media-collection-items.controllers.js";
import { validateParams } from "../../middleware/validateParams.js";

const router = Router();

router.post("/", createMediaCollectionItem);
router.get("/", listMediaCollectionItems);
router.get(
      "/:collectionId/:mediaId",
      validateParams("collectionId", "mediaId"),
      getMediaCollectionItem,
);
router.patch(
      "/:collectionId/:mediaId",
      validateParams("collectionId", "mediaId"),
      updateMediaCollectionItem,
);
router.delete(
      "/:collectionId/:mediaId",
      validateParams("collectionId", "mediaId"),
      deleteMediaCollectionItem,
);

export default router;
