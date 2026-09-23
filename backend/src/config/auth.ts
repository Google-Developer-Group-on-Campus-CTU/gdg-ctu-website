import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { redisStorage } from "@better-auth/redis-storage";
import { Redis } from "ioredis";
import ENV, { AUTH_BASE_PATH } from "./env.js";
import { db } from "./connectDB.js";
import logger from "../utils/logger.js";
import { validateBetterAuthKeys } from "../utils/serverValidation.js";
import {
      account,
      accountRelations,
      session,
      sessionRelations,
      user,
      userRelations,
      verification,
} from "../modules/auth/models/auth.js";

// Fatal boot check — BETTER_AUTH_SECRET + BETTER_AUTH_URL (server.ts calls
// the same validator again before mounting; import order means this runs
// first, both paths exit(1) on bad config).
const { secret, baseURL } = validateBetterAuthKeys(
      ENV.BETTER_AUTH_SECRET,
      ENV.BETTER_AUTH_URL,
);

/**
 * Bootstrap admins: comma-separated user IDs the admin plugin treats as
 * admins even while their role is still the default "user". Lets you sign up
 * once with email/password, then promote yourself via ADMIN_USER_IDS instead
 * of a dev-only request bypass (which was dropped in the Clerk → Better Auth
 * migration).
 */
export const adminUserIds: string[] = (ENV.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

/** Roles the admin plugin (and requireAuth) treat as admin. */
export const adminRoles: string[] = ["admin"];

// FR_ORIGIN may be a comma-separated allowlist — same normalization as CORS.
const trustedOrigins = (ENV.FR_ORIGIN ?? "")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean);

const hasGoogleProvider = Boolean(
      ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_SECRET,
);

// Redis-backed secondary storage for sessions (reuse REDIS_URL). lazyConnect:
// the client is connected during the boot chain via connectAuthRedis() so a
// down Redis fails the boot all-or-nothing, and tools that merely import this
// config (better-auth CLI / drizzle-kit) never open a connection.
const redisClient = ENV.REDIS_URL
      ? new Redis(ENV.REDIS_URL, { lazyConnect: true })
      : null;
redisClient?.on("error", (err: Error) =>
      logger.error("Better Auth Redis (ioredis) error", { message: err.message }),
);

/** Connect the Better Auth Redis client — no-op when REDIS_URL is unset. */
export async function connectAuthRedis(): Promise<void> {
      if (!redisClient || redisClient.status !== "wait") return;
      await redisClient.connect();
      logger.info("Better Auth Redis connection established");
}

export const auth = betterAuth({
      secret,
      // Origin (preferred) or full auth URL — validated to match the mount.
      baseURL,
      // Must match the toNodeHandler mount in server.ts AND the frontend
      // auth client (VITE_API_URL already includes the API version prefix,
      // so its default "/api/auth" resolves to this same path).
      basePath: AUTH_BASE_PATH,
      trustedOrigins,
      emailAndPassword: {
            enabled: true,
            requireEmailVerification: true,
      },
      socialProviders: hasGoogleProvider
            ? {
                    google: {
                          clientId: ENV.GOOGLE_CLIENT_ID!,
                          clientSecret: ENV.GOOGLE_CLIENT_SECRET!,
                    },
              }
            : {},
      session: {
            expiresIn: 60 * 60 * 24 * 7, // 7 days
            updateAge: 60 * 60 * 24, // refresh the session when >1 day old
            cookieCache: { enabled: false }, // OFF — always hit storage
      },
      advanced: {
            trustedProxyHeaders: true,
            database: { joins: true },
      },
      secondaryStorage: redisClient
            ? redisStorage({ client: redisClient })
            : undefined,
      database: drizzleAdapter(db, {
            provider: "pg",
            schema: {
                  user,
                  session,
                  account,
                  verification,
                  userRelations,
                  sessionRelations,
                  accountRelations,
            },
      }),
      plugins: [
            admin({
                  adminRoles,
                  defaultRole: "user",
                  adminUserIds,
            }),
      ],
});

export const googleProviderEnabled = hasGoogleProvider;
