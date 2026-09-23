import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { count } from "drizzle-orm";
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

export const auth = betterAuth({
      secret,
      // Origin (preferred) or full auth URL — validated to match the mount.
      baseURL,
      // Must match the toNodeHandler mount in server.ts AND the frontend
      // auth client (VITE_API_URL already includes the API version prefix,
      // so its default "/api/auth" resolves to this same path).
      basePath: AUTH_BASE_PATH,
      trustedOrigins,
      // First-admin bootstrap: when the `user` table is completely empty,
      // the very first signup (email/password, invite redeem via
      // signUpEmail, Google social — all funnel through user creation)
      // becomes admin. Also forces emailVerified=true for that row, because
      // requireEmailVerification is on and no mail sender is configured —
      // without it the first admin would get no session.
      //
      // Verified against better-auth 1.7.5 / @better-auth/core
      // (init-options.d.mts): databaseHooks.user.create.before receives the
      // pending user and may return { data } to shallow-merge overrides, or
      // void to leave it untouched (with-hooks.mjs). The admin plugin
      // registers its own create.before (role defaulting) — both hooks run
      // in sequence over the same merged row, so our role/emailVerified
      // override is preserved regardless of plugin/option hook order.
      databaseHooks: {
            user: {
                  create: {
                        before: async () => {
                              try {
                                    const rows = await db
                                          .select({ total: count() })
                                          .from(user);
                                    const total = rows[0]?.total ?? 0;
                                    if (total > 0) {
                                          // Not the first user — leave data untouched.
                                          return;
                                    }
                                    logger.info(
                                          "Empty user table — promoting first signup to admin",
                                    );
                                    return {
                                          data: {
                                                role: "admin",
                                                emailVerified: true,
                                          },
                                    };
                              } catch (error) {
                                    logger.error(
                                          "First-admin bootstrap hook failed",
                                          {
                                                message:
                                                      error instanceof Error
                                                            ? error.message
                                                            : String(error),
                                          },
                                    );
                                    // Fail closed: without a reliable count the
                                    // first admin could silently stay a normal
                                    // emailVerified=false user with no way in.
                                    throw error;
                              }
                        },
                  },
            },
      },
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
