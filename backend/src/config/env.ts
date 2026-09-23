import dotenv from "dotenv";
dotenv.config();

/**
 * Where Better Auth routes are mounted (Express + Better Auth router +
 * frontend auth client must all agree). Exported here so env validation,
 * config/auth.ts and server.ts share a single source of truth.
 */
export const AUTH_BASE_PATH = "/GDGoC-CTU-Main/v0.0.1/api/auth";

const ENV = {
      PORT: process.env.PORT,
      NODE_ENV: process.env.NODE_ENV,
      DB_URL: process.env.DB_URL,
      FR_ORIGIN: process.env.FR_ORIGIN,
      CLOUDINARY_URL: process.env.CLOUDINARY_URL,
      REDIS_URL: process.env.REDIS_URL,
      // Better Auth — secret signs/encrypts session cookies; URL is the
      // public backend origin (or the full auth base URL), used for
      // redirects/OAuth callbacks. Validated fatally at boot.
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
      // Google OAuth (optional — social sign-in disabled until both set).
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      // Optional bootstrap: comma-separated user IDs treated as admins even
      // when their role is still the default "user" (admin plugin
      // `adminUserIds` — replaces the old DEV_ADMIN_BYPASS).
      ADMIN_USER_IDS: process.env.ADMIN_USER_IDS,
};

export default ENV;
