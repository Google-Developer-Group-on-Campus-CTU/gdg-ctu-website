import { Router } from "express";
import {
      getContactMessage,
      listContactMessages,
      removeContactMessage,
      updateContactMessage,
} from "./contact-messages.controllers.js";
import { validateParams } from "../../middleware/validateParams.js";

const router = Router();

router.get("/", listContactMessages);
router.get("/:id", validateParams("id"), getContactMessage);
router.patch("/:id", validateParams("id"), updateContactMessage);
router.delete("/:id", validateParams("id"), removeContactMessage);

export default router;
