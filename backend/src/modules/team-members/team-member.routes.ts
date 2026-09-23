import { Router } from "express";
import upload from "../../middleware/upload.js";
import {
      createTeamMemberWithImage,
      listTeamMembers,
      getTeamMember,
      getTeamMemberBySlug,
      listTeamMembersByTerm,
      updateTeamMember,
      removeTeamMember,
} from "./team-member.controllers.js";

const router = Router();

router.post("/", upload.single("file"), createTeamMemberWithImage);
router.get("/", listTeamMembers);
router.get("/slug/:slug", getTeamMemberBySlug);
router.get("/:id", getTeamMember);
router.get("/termId/:termId", listTeamMembersByTerm);
router.patch("/:id", upload.single("file"), updateTeamMember);

router.delete("/:id", removeTeamMember);
export default router;
