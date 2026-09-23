import { Router } from "express";
import {
      createEventAttendee,
      listEventAttendees,
      getEventAttendee,
      updateEventAttendee,
      deleteEventAttendee,
} from "./event-attendees.controllers.js";
import { validateParams } from "../../middleware/validateParams.js";
import { validateQuery } from "../../middleware/validateQuery.js";

const router = Router();

router.post("/", createEventAttendee);
router.get("/", validateQuery("page", "limit"), listEventAttendees);
router.get("/:id", validateParams("id"), getEventAttendee);
router.patch("/:id", validateParams("id"), updateEventAttendee);
router.delete("/:id", validateParams("id"), deleteEventAttendee);

export default router;
