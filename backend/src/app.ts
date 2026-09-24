// backend/src/app.ts
//
// Serverless-safe app module (Render → Vercel migration): importing this
// file only ASSEMBLES the Express app — pure in-process wiring with no
// side effects beyond construction: no server listen, no process
// termination, no network I/O (the pg pool is constructed without I/O and
// connects lazily on the first query; Cloudinary's api.ping lives only in
// the dev entry).
// Consumers: server.ts (dev/serverful entry) and, in a later phase, the
// Vercel handler.
import express from "express";
import type { NextFunction, Request, Response } from "express";

import ENV, { AUTH_BASE_PATH } from "./config/env.js";
import { auth, googleProviderEnabled } from "./config/auth.js";
import apiRoutes from "./modules/index.js";
import logger from "./utils/logger.js";
import {
      configureCors,
      configureEnvironmentRoutes,
      validateFrontendOrigin,
      validateProductionMode,
} from "./utils/serverValidation.js";
import { toNodeHandler } from "better-auth/node";
import { MAX_FILE_SIZE_BYTES } from "./middleware/upload.js";

// Config checks live where the values are consumed. These THROW the same
// messages the old fatal-exit paths printed — exiting the process is legal
// only in the dev entry (server.ts), which imports this module inside its
// boot catch, so a bad FR_ORIGIN/NODE_ENV still dies as one logged error.
const FR_ORIGIN = validateFrontendOrigin(ENV.FR_ORIGIN);
const isProduction = validateProductionMode(ENV.NODE_ENV);

if (!googleProviderEnabled) {
      logger.warn(
            "Google social sign-in disabled — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set",
      );
}

export const app = express();

// --- MIDDLEWARE ---
// CORS: FR_ORIGIN comma allowlist (trimmed, trailing slashes stripped);
// in development any localhost/127.0.0.1 loopback port is also allowed.
configureCors(app, FR_ORIGIN, isProduction);

// Better Auth node handler — mounted BEFORE express.json(): Better Auth
// parses the raw body itself. Path must match AUTH_BASE_PATH (frontend
// auth client calls VITE_API_URL + "/api/auth/*").
app.all(`${AUTH_BASE_PATH}/*splat`, toNodeHandler(auth));

// Explicit JSON cap (Gate 4): 100kb — identical to body-parser's default,
// so zero behaviour change, now stated rather than implicit. Every legit
// JSON body is a single-entity admin form (site-content markdown `body`,
// bios/descriptions = small textareas; reorder = {displayOrder}); no
// bulk-JSON routes exist — file bytes ride multipart/direct-upload only.
app.use(express.json({ limit: "100kb" }));

// ROUTES SECTION
app.use("/GDGoC-CTU-Main/v0.0.1", apiRoutes);
configureEnvironmentRoutes(app);

// Multer runs INSIDE the routers before any controller, so oversized or
// contract-breaking multipart requests only ever reach this error
// middleware (4-arity = Express error handler, registered last). Every
// single request is capped at 4MB (Vercel Hobby hard-caps bodies at
// 4.5MB); LIMIT_FILE_SIZE aborts mid-stream and maps to a clear 413.
// JSON bodies are capped separately by express.json({ limit }) above —
// body-parser's entity.too.large maps to the same 413 JSON shape here.
app.use(
      (err: unknown, _req: Request, res: Response, next: NextFunction) => {
            const typedErr = err as { name?: string; code?: string; type?: string };
            if (typedErr?.name === "MulterError") {
                  if (typedErr.code === "LIMIT_FILE_SIZE") {
                        return res.status(413).json({
                              success: false,
                              message: `Upload too large: maximum ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB per request.`,
                        });
                  }
                  return res.status(400).json({
                        success: false,
                        message: `Invalid multipart upload (${typedErr.code ?? "unknown error"}).`,
                  });
            }
            // JSON body over the express.json limit (PayloadTooLargeError):
            // respond 413 JSON instead of the default HTML error page.
            if (typedErr?.type === "entity.too.large") {
                  return res.status(413).json({
                        success: false,
                        message: "Payload too large: JSON body exceeds the 100kb limit.",
                  });
            }
            // Anything else (fileFilter type errors, unexpected throws) falls
            // through to the final JSON error handler below — never Express's
            // default HTML error page, so the API contract stays JSON.
            return next(err);
      },
);

// Final JSON error handler (registered last): guarantees every error that
// escapes the routers — including rethrown coding bugs from requireAuth —
// leaves as JSON, never Express's default HTML error page.
app.use(
      (
            err: unknown,
            _req: Request,
            res: Response,
            _next: NextFunction,
      ) => {
            const statusCode = getErrorStatusCode(err);
            const message =
                  err instanceof Error && err.message
                        ? err.message
                        : "Internal server error";
            logger.error("Unhandled API error", {
                  message,
                  stack: err instanceof Error ? err.stack : undefined,
            });
            return res.status(statusCode).json({
                  success: false,
                  message:
                        statusCode === 500 && isProduction
                              ? "Internal server error"
                              : message,
            });
      },
);

function getErrorStatusCode(err: unknown): number {
      if (typeof err === "object" && err !== null) {
            const statusCode = (err as { statusCode?: unknown }).statusCode;
            if (typeof statusCode === "number") {
                  return statusCode;
            }
            const status = (err as { status?: unknown }).status;
            if (typeof status === "number") {
                  return status;
            }
      }
      return 500;
}

export default app;
