import { Router } from "express";
import {
      createTerm,
      deleteTerm,
      getTerm,
      listTerms,
      updateTerm,
} from "./terms.controllers.js";
import { validateParams } from "../../middleware/validateParams.js";
import { validateQuery } from "../../middleware/validateQuery.js";

const router = Router();

router.post("/", createTerm);
router.get("/", validateQuery("page", "limit"), listTerms);
router.get("/:id", validateParams("id"), getTerm);
router.patch("/:id", validateParams("id"), updateTerm);
router.delete("/:id", validateParams("id"), deleteTerm);

export default router;
