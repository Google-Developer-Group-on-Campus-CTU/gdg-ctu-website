import { Express, Request, Response } from "express";
import cors from "cors";
import logger from "./logger";

// Check port validity
export function validateServerPort(port: string | undefined): number {
      if (!port) {
            logger.info("Error: PORT is not defined in environment variables.");
            process.exit(1);
      }

      const parsedPort = Number(port);

      if (
            Number.isNaN(parsedPort) ||
            parsedPort < 0 ||
            parsedPort > 65535 ||
            !Number.isInteger(parsedPort)
      ) {
            logger.info("Error: PORT is not a valid port number.");
            process.exit(1);
      }

      return parsedPort;
}

// Check Frontend Origin validity
export function validateFrontendOrigin(frOrigin: string | undefined): string {
      if (!frOrigin) {
            logger.info(
                  "Error: FR_ORIGIN is not defined in environment variables.",
            );
            process.exit(1);
      }

      return frOrigin;
}

// Check if clerk keys exist
export function validateClerkKeys(
      clerkPubKey: string | undefined,
      clerkSecKey: string | undefined,
): { publishableKey: string; secretKey: string } {
      if (!clerkPubKey || !clerkSecKey) {
            logger.info(
                  "Error: CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY must be set in environment variables.",
            );
            process.exit(1);
      }

      return {
            publishableKey: clerkPubKey,
            secretKey: clerkSecKey,
      };
}

// Check if server is in production mode
export function validateProductionMode(mode: string | undefined): boolean {
      if (!mode) {
            logger.info(
                  "Error: NODE_ENV is not defined in environment variables.",
            );
            process.exit(1);
      }

      return mode === "production";
}

// Configure CORS based on frontend origin and production mode
export function configureCors(
      app: Express,
      frontendOrigin: string,
      isProduction: boolean,
) {
      // FR_ORIGIN may be a single origin or a comma-separated list.
      // Normalize: trim whitespace + trailing slashes — a trailing slash
      // (e.g. "http://localhost:5173/") never equals the browser Origin
      // ("http://localhost:5173") and causes exactly the reported
      // "Access-Control-Allow-Origin does not match Origin" failure.
      const allowlist = frontendOrigin
            .split(",")
            .map((o) => o.trim().replace(/\/+$/, ""))
            .filter(Boolean);

      // Local loopback origins (any port) are safe to allow in development
      // so Vite dev (5173), preview (4173), or a custom --port never trips
      // CORS when the backend stays on :3000.
      const isDevLoopback = (origin: string) =>
            /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

      app.use(
            cors({
                  origin: (origin, callback) => {
                        // Same-origin / curl / health probes send no Origin.
                        if (!origin) return callback(null, true);
                        if (allowlist.includes(origin))
                              return callback(null, true);
                        if (!isProduction && isDevLoopback(origin))
                              return callback(null, true);
                        logger.warn(`CORS: blocked origin ${origin}`);
                        return callback(null, false);
                  },
                  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
                  allowedHeaders: [
                        "Content-Type",
                        "Authorization",
                        // DEV-ONLY: instant-admin bypass (requireAuth.ts).
                        // Harmless in production — bypass itself is gated on
                        // NODE_ENV !== "production" && DEV_ADMIN_BYPASS === "true".
                        "x-dev-admin-bypass",
                  ],
                  credentials: true,
                  optionsSuccessStatus: 204,
            }),
      );

      return logger.info(
            `CORS: [${allowlist.join(", ")}] Running in ${isProduction ? "Production" : "Development"} Mode`,
      );
}

// Configure fallback routes — API-only, frontend hosted separately
export function configureEnvironmentRoutes(app: Express) {
      // Top-level liveness probes for Render / load-balancer health checks.
      // Render probes GET / by default; must return 200 or deploy stays stuck
      // in "Deploying". Keep versioned /GDGoC-CTU-Main/v0.0.1/health as well.
      const liveness = (_req: Request, res: Response) => {
            res.status(200).json({
                  success: true,
                  status: "ok",
                  service: "gdg-ctu-backend",
                  timestamp: new Date().toISOString(),
            });
      };
      app.get("/", liveness);
      app.get("/health", liveness);
      // Catch-all: return 404 for unmatched routes
      app.use((_req, res) => {
            res.status(404).json({ message: "API endpoint not found" });
      });
}
