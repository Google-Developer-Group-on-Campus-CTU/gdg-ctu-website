import { Router } from "express";
import {
      createAdmin,
      getAdmin,
      listAdmins,
      removeAdmin,
      updateAdmin,
} from "./admin.controllers.js";
import { validateParams } from "../../middleware/validateParams.js";
import { validateQuery } from "../../middleware/validateQuery.js";

const router = Router();

router.post("/", createAdmin);
router.get("/", validateQuery("page", "limit"), listAdmins);
router.get("/:id", validateParams("id"), getAdmin);
router.patch("/:id", validateParams("id"), updateAdmin);
router.delete("/:id", validateParams("id"), removeAdmin);

export default router;
