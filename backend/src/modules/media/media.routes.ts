import { Router } from "express";
import {
      createMedia,
      listMedia,
      getMedia,
      updateMedia,
      removeMedia,
} from "./media.controllers.js";
import { validateParams } from "../../middleware/validateParams.js";
import { validateQuery } from "../../middleware/validateQuery.js";
import upload from "../../middleware/upload.js";

const router = Router();

router.post("/", upload.single("file"), createMedia);
router.get("/", validateQuery("page", "limit"), listMedia);
router.get("/:id", validateParams("id"), getMedia);
router.patch("/:id", validateParams("id"), upload.single("file"), updateMedia);
router.delete("/:id", validateParams("id"), removeMedia);

export default router;
