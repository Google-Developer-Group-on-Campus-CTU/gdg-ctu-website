import { Router } from "express";
import {
      createMediaCollection,
      listMediaCollections,
      getMediaCollection,
      updateMediaCollection,
      deleteMediaCollection,
} from "./media-collections.controllers.js";
import { validateParams } from "../../middleware/validateParams.js";
import { validateQuery } from "../../middleware/validateQuery.js";

const router = Router();

router.post("/", createMediaCollection);
router.get("/", validateQuery("page", "limit"), listMediaCollections);
router.get("/:id", validateParams("id"), getMediaCollection);
router.patch("/:id", validateParams("id"), updateMediaCollection);
router.delete("/:id", validateParams("id"), deleteMediaCollection);

export default router;
