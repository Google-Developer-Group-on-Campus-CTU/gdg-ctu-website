import { Router } from "express";
import upload from "../../middleware/upload.js";
import {
      createPartner,
      getPartner,
      getPartnerBySlug,
      listPartners,
      removePartner,
      updatePartner,
} from "./partner.controllers.js";

const router = Router();

router.post("/", upload.single("file"), createPartner);
router.get("/", listPartners);
router.get("/slug/:slug", getPartnerBySlug);
router.get("/:id", getPartner);
router.patch("/:id", upload.single("file"), updatePartner);
router.delete("/:id", removePartner);

export default router;
