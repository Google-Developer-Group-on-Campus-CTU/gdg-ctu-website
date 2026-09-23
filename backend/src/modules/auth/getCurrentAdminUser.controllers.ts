import { Request, Response } from "express";
import type { AuthedRequest } from "../../middleware/requireAuth.js";
import { serializeAdmin } from "./serializeAdmin.js";
import logger from "../../utils/logger.js";
import { handleControllerError } from "../../utils/http.js";

export async function getCurrentAdminUser(req: Request, res: Response) {
      try {
            // requireAuth (mounted upstream on the protected router) has
            // already resolved the Better Auth session for this request.
            const session = (req as Partial<AuthedRequest>).authSession;

            if (!session?.user) {
                  res.status(401).json({ error: "Unauthorized" });
                  return;
            }

            res.json({
                  success: true,
                  message: "User fetched successfully",
                  user: serializeAdmin(session.user),
            });
      } catch (error: any) {
            logger.error(error, { message: error.message, stack: error.stack });
            handleControllerError(res, error, "Internal Server Error");
      }
}
