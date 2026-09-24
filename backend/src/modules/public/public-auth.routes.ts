import { Router } from "express";
import { count } from "drizzle-orm";
import { db } from "../../config/connectDB.js";
import { user } from "../auth/models/auth.js";
import { handleControllerError } from "../../utils/http.js";

/**
 * Public auth probe — no auth. Lets the login page detect first-run state
 * (zero user rows ⇒ first admin signup has not happened yet).
 *
 * Only the boolean is returned, never the raw count (no user enumeration).
 */
const router = Router();

// GET /public/auth/setup-status — first-run check for the login page
router.get("/setup-status", async (_req, res) => {
      try {
            const [row] = await db.select({ total: count() }).from(user);
            const setupNeeded = (row?.total ?? 0) === 0;
            return res.status(200).json({
                  success: true,
                  setupNeeded,
            });
      } catch (error) {
            return handleControllerError(
                  res,
                  error,
                  "Failed to check setup status",
            );
      }
});

export default router;
