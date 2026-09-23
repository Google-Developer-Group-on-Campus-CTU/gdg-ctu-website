import ENV, { AUTH_BASE_PATH } from "./config/env.js";
import express from "express";
import logger from "./utils/logger.js";
import { connectDB } from "./config/connectDB.js";
import { testCloudinaryConnection } from "./config/cloudinary/cloudinary.connection.js";
import apiRoutes from "./modules/index.js";
import {
      validateServerPort,
      validateFrontendOrigin,
      validateBetterAuthKeys,
      validateProductionMode,
      configureCors,
      configureEnvironmentRoutes,
} from "./utils/serverValidation.js";
import { toNodeHandler } from "better-auth/node";
import { auth, googleProviderEnabled } from "./config/auth.js";

const app = express();
const PORT = validateServerPort(ENV.PORT);
const FR_ORIGIN = validateFrontendOrigin(ENV.FR_ORIGIN);
const isProduction = validateProductionMode(ENV.NODE_ENV);
// Fatal boot check — BETTER_AUTH_SECRET + BETTER_AUTH_URL (config/auth.ts
// runs the same validator at import time; both happen before listen).
validateBetterAuthKeys(ENV.BETTER_AUTH_SECRET, ENV.BETTER_AUTH_URL);
if (!googleProviderEnabled) {
      logger.warn(
            "Google social sign-in disabled — GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set",
      );
}

// --- MIDDLEWARE ---
configureCors(app, FR_ORIGIN, isProduction);

// Better Auth node handler — mounted BEFORE express.json(): Better Auth
// parses the raw body itself. Path must match AUTH_BASE_PATH (frontend
// auth client calls VITE_API_URL + "/api/auth/*").
app.all(`${AUTH_BASE_PATH}/*splat`, toNodeHandler(auth));

app.use(express.json());

// ROUTES SECTION
app.use("/GDGoC-CTU-Main/v0.0.1", apiRoutes);
configureEnvironmentRoutes(app);

// All-or-nothing boot: DB (+migrations) → Cloudinary → listen.
connectDB()
      .then(() => testCloudinaryConnection())
      .then(() => {
            app.listen(PORT, "0.0.0.0", () => {
                  logger.info(`Server is running on port ${PORT}`);
            });
      })
      .catch((err) => {
            logger.error("Failed to start server:", {
                  message: err.message,
                  stack: err.stack,
            });
            process.exit(1);
      });
