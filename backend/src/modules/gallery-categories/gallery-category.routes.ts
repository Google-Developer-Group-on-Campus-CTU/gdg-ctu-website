import { Router } from "express";
import {
      createGalleryCategory,
      getGalleryCategory,
      getGalleryCategoryBySlug,
      listGalleryCategories,
      removeGalleryCategory,
      updateGalleryCategory,
} from "./gallery-category.controllers.js";
import { validateParams } from "../../middleware/validateParams.js";

const router = Router();

router.post("/", createGalleryCategory);
router.get("/", listGalleryCategories);
router.get("/slug/:slug", getGalleryCategoryBySlug);
router.get("/:id", validateParams("id"), getGalleryCategory);
router.patch("/:id", validateParams("id"), updateGalleryCategory);
router.delete("/:id", validateParams("id"), removeGalleryCategory);

export default router;
