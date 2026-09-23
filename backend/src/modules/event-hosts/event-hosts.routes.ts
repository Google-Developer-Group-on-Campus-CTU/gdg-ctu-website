import { Router } from "express";
import {
      createEventHost,
      listEventHosts,
      getEventHost,
      updateEventHost,
      deleteEventHost,
} from "./event-hosts.controllers.js";
import { validateParams } from "../../middleware/validateParams.js";

const router = Router();

router.post("/", createEventHost);
router.get("/", listEventHosts);
router.get("/:id", validateParams("id"), getEventHost);
router.patch("/:id", validateParams("id"), updateEventHost);
router.delete("/:id", validateParams("id"), deleteEventHost);

export default router;
