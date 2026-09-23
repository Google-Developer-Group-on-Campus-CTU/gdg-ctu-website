import { Router } from "express";
import {
      createMemberTerm,
      listMemberTerms,
      getMemberTerm,
      updateMemberTerm,
      deleteMemberTerm,
} from "./member-terms.controllers.js";
import { validateParams } from "../../middleware/validateParams.js";

const router = Router();

router.post("/", createMemberTerm);
router.get("/", listMemberTerms);
router.get("/:id", validateParams("id"), getMemberTerm);
router.patch("/:id", validateParams("id"), updateMemberTerm);
router.delete("/:id", validateParams("id"), deleteMemberTerm);

export default router;
