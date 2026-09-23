import { Router } from "express";
import upload from "../../middleware/upload.js";
import {
      createEventSpeaker,
      getEventSpeaker,
      getEventSpeakerBySlug,
      listEventSpeakers,
      listEventSpeakersForTeamMember,
      removeEventSpeaker,
      updateEventSpeaker,
} from "./event-speaker.controllers.js";

const router = Router();

router.post("/", upload.single("file"), createEventSpeaker);
router.get("/", listEventSpeakers);
router.get("/slug/:slug", getEventSpeakerBySlug);
router.get("/:id", getEventSpeaker);
router.patch("/:id", upload.single("file"), updateEventSpeaker);
router.delete("/:id", removeEventSpeaker);
router.get(
      "/team-members/:teamMemberId/event-speakers",
      listEventSpeakersForTeamMember,
);

export default router;
