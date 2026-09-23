import { Router } from "express";
import {
      createEventAttendee,
      listEventAttendees,
      getEventAttendee,
      updateEventAttendee,
      deleteEventAttendee,
} from "./event-attendees.controllers.js";
import { validateParams } from "../../middleware/validateParams.js";

const router = Router();

router.post("/", createEventAttendee);
router.get("/", listEventAttendees);
router.get("/:id", validateParams("id"), getEventAttendee);
router.patch("/:id", validateParams("id"), updateEventAttendee);
router.delete("/:id", validateParams("id"), deleteEventAttendee);

export default router;
