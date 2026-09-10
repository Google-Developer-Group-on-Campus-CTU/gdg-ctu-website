import ENV from "./config/env";
import express from "express";
import logger from "./utils/logger";
import { connectDB } from "./config/connectDB";
import { testCloudinaryConnection } from "./config/cloudinary/cloudinary.connection";
import { testRedisConnection } from "./config/redis/redis.config";
import apiRoutes from "./modules";
import {
      validateServerPort,
      validateFrontendOrigin,
      validateClerkKeys,
      validateProductionMode,
      configureCors,
      configureEnvironmentRoutes,
} from "./utils/serverValidation";
import { clerkMiddleware } from "@clerk/express";

const app = express();
const PORT = validateServerPort(ENV.PORT);
const FR_ORIGIN = validateFrontendOrigin(ENV.FR_ORIGIN);
const isProduction = validateProductionMode(ENV.NODE_ENV);
validateClerkKeys(ENV.CLERK_PUBLISHABLE_KEY, ENV.CLERK_SECRET_KEY);

// --- MIDDLEWARE ---
app.use(express.json());
configureCors(app, FR_ORIGIN, isProduction);
// --- CLERK MIDDLEWARE ---
app.use(clerkMiddleware());

// ROUTES SECTION
app.use("/GDGoC-CTU-Main/v0.0.1", apiRoutes);
configureEnvironmentRoutes(app);

connectDB()
      .then(() => testCloudinaryConnection())
      .then(() => testRedisConnection())
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
