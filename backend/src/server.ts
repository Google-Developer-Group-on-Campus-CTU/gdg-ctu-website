// backend/src/server.ts — dev / serverful entry ONLY (Render-style
// long-running process). This file is the only place in src/ allowed to
// call process.exit().
//
// Boot order mirrors the pre-migration server: config validation → app
// assembly → DB ping → Cloudinary ping → listen. The app module is
// imported dynamically so a config error raised DURING its import lands
// in this same catch instead of dying as an uncaught exception.
import ENV from "./config/env.js";
import { connectDB } from "./config/connectDB.js";
import { testCloudinaryConnection } from "./config/cloudinary/cloudinary.connection.js";
import logger from "./utils/logger.js";
import {
      validateBetterAuthKeys,
      validateServerPort,
} from "./utils/serverValidation.js";

async function boot(): Promise<void> {
      const PORT = validateServerPort(ENV.PORT);
      // Fatal config check — config/auth.ts runs the same validator at its
      // import time; both throw (never exit) and both happen before listen.
      validateBetterAuthKeys(ENV.BETTER_AUTH_SECRET, ENV.BETTER_AUTH_URL);
      const { app } = await import("./app.js");
      // All-or-nothing boot: DB connectivity → Cloudinary → listen.
      await connectDB();
      await testCloudinaryConnection();
      app.listen(PORT, "0.0.0.0", () => {
            logger.info(`Server is running on port ${PORT}`);
      });
}

boot().catch((err) => {
      logger.error("Failed to start server:", {
            message: err.message,
            stack: err.stack,
      });
      process.exit(1);
});
