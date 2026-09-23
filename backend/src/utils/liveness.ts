import { Request, Response } from "express";

/**
 * Single source of truth for the liveness probe payload.
 *
 * Mounted at exactly three places (all must stay alive — Render's deploy
 * health check probes GET / and stalls in "Deploying" if it drops):
 *   1. GET /                                      (configureEnvironmentRoutes)
 *   2. GET /health                                (configureEnvironmentRoutes)
 *   3. GET /GDGoC-CTU-Main/v0.0.1/health          (modules/health via modules/index.ts)
 */
export const livenessHandler = (_req: Request, res: Response) => {
      res.status(200).json({
            success: true,
            status: "ok",
            service: "gdg-ctu-backend",
            timestamp: new Date().toISOString(),
      });
};
