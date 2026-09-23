import { Router } from "express";
import {
      createMedia,
      listMedia,
      getMedia,
      updateMedia,
      removeMedia,
} from "./media.controllers";
import { validateParams } from "../../middleware/validateParams";
import { validateQuery } from "../../middleware/validateQuery";
import upload from "../../middleware/upload";

const router = Router();

router.post("/", upload.single("file"), createMedia);
router.get("/", validateQuery("page", "limit"), listMedia);
router.get("/:id", validateParams("id"), getMedia);
router.patch("/:id", validateParams("id"), upload.single("file"), updateMedia);
router.delete("/:id", validateParams("id"), removeMedia);

export default router;
