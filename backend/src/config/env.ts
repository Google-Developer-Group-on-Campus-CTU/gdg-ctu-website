import dotenv from "dotenv";
dotenv.config();
import { z } from "zod";

/**
 * Where Better Auth routes are mounted (Express + Better Auth router +
 * frontend auth client must all agree). Exported here so env validation,
 * config/auth.ts and server.ts share a single source of truth.
 */
export const AUTH_BASE_PATH = "/GDGoC-CTU-Main/v0.0.1/api/auth";

// Central ENV contract — validated once at import, fail fast. Required keys
// (PORT number, DB_URL url, FR_ORIGIN, both Better Auth keys) throw here
// instead of surfacing as cryptic failures at boot, first query, or cold
// start. Optional integrations stay optional: missing CLOUDINARY_URL only
// disables Cloudinary paths (503), missing Google keys only disable social
// sign-in. NOTE: no logger use in this module — logger imports ENV, so
// logging here would be an import cycle; the dev entry (server.ts) and the
// Vercel handler surface this throw as one logged error.
const EnvSchema = z.object({
      PORT: z.coerce.number().int().min(0).max(65535),
      NODE_ENV: z.string().trim().min(1),
      DB_URL: z.string().trim().min(1).url(),
      FR_ORIGIN: z.string().trim().min(1),
      CLOUDINARY_URL: z.string().trim().optional(),
      // Better Auth — secret signs/encrypts session cookies; URL is the
      // public backend origin (or the full auth base URL), used for
      // redirects/OAuth callbacks. Validated fatally at boot.
      BETTER_AUTH_SECRET: z.string().min(1),
      BETTER_AUTH_URL: z.string().min(1),
      // Google OAuth (optional — social sign-in disabled until both set).
      GOOGLE_CLIENT_ID: z.string().optional(),
      GOOGLE_CLIENT_SECRET: z.string().optional(),
      // Optional bootstrap: comma-separated user IDs treated as admins even
      // when their role is still the default "user" (admin plugin
      // `adminUserIds` — replaces the old DEV_ADMIN_BYPASS).
      ADMIN_USER_IDS: z.string().optional(),
      LOG_LEVEL: z.string().trim().default("info"),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
      const details = parsed.error.issues
            .map((issue) => {
                  const path = issue.path.join(".");
                  return path ? `${path}: ${issue.message}` : issue.message;
            })
            .join("; ");
      throw new Error(`Invalid environment configuration: ${details}`);
}

const ENV = parsed.data;

export type Env = z.infer<typeof EnvSchema>;

export default ENV;
