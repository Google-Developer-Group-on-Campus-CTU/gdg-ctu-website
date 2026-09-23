import { Router } from "express";
import {
      createMediaCollection,
      listMediaCollections,
      getMediaCollection,
      updateMediaCollection,
      deleteMediaCollection,
} from "./media-collections.controllers";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import upload from "../../middleware/upload";

const router = Router();

router.post(
      "/",
      upload.fields([
            { name: "collectionCoverImage", maxCount: 1 },
            { name: "imageCollections", maxCount: 10 },
      ]),
      createMediaCollection,
);
router.get("/", validateQuery("page", "limit"), listMediaCollections);
router.get("/:id", validateParams("id"), getMediaCollection);
router.patch(
      "/:id",
      validateParams("id"),
      upload.fields([{ name: "imageCollectionsAdd", maxCount: 10 }]),
      updateMediaCollection,
);
router.delete("/:id", validateParams("id"), deleteMediaCollection);

export default router;
