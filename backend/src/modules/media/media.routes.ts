import { Router } from "express";
import {
      createMedia,
      listMedia,
      getMedia,
      updateMedia,
      removeMedia,
      signUpload,
} from "./media.controllers.js";
import { validateParams } from "../../middleware/validateParams.js";
import upload from "../../middleware/upload.js";

const router = Router();

router.post("/", upload.single("file"), createMedia);
// Signed direct-to-Cloudinary params (JSON, no multipart — bytes never
// transit the function; see signDirectUpload).
router.post("/sign-upload", signUpload);
router.get("/", listMedia);
router.get("/:id", validateParams("id"), getMedia);
router.patch("/:id", validateParams("id"), upload.single("file"), updateMedia);
router.delete("/:id", validateParams("id"), removeMedia);

export default router;
