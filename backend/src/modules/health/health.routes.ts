import { Router } from "express";
import { livenessHandler } from "../../utils/liveness.js";

/** Liveness probe — replaces GET /admins as the deployment health check. */
const router = Router();

router.get("/", livenessHandler);

export default router;
