import upload from "../../middleware/upload";
import { Router } from "express";
import {
      createEvent,
      getEvent,
      getEventBySlug,
      listEvents,
      removeEvent,
      updateEvent,
} from "./event.controllers";

const router = Router();

router.post("/", upload.single("file"), createEvent);
router.get("/", listEvents);
router.get("/slug/:slug", getEventBySlug);
router.get("/:id", getEvent);
router.patch("/:id", upload.single("file"), updateEvent);
router.delete("/:id", removeEvent);

export default router;
