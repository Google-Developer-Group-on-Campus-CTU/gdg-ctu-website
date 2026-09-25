import { Router } from "express";
import { submitContactMessage } from "./contact-messages.controllers.js";

const router = Router();

// POST /public/contact-messages — no auth. Website contact form submit.
router.post("/", submitContactMessage);

export default router;
