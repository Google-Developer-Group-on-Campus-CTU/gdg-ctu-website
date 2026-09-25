import { Router } from "express";
import { desc } from "drizzle-orm";
import { db } from "../../config/connectDB.js";
import { terms } from "../terms/models/terms.js";
import { handleControllerError } from "../../utils/http.js";

/**
 * Public terms feed — no auth. Term picklist for the website
 * (id + name + isCurrent, newest term first).
 */
const router = Router();

router.get("/", async (_req, res) => {
      try {
            const rows = await db
                  .select({
                        id: terms.id,
                        name: terms.name,
                        isCurrent: terms.isCurrent,
                  })
                  .from(terms)
                  .orderBy(desc(terms.startDate));
            return res.status(200).json({ success: true, terms: rows });
      } catch (error) {
            return handleControllerError(res, error, "Failed to list public terms");
      }
});

export default router;
