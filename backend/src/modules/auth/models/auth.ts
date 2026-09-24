import {
      boolean,
      check,
      index,
      integer,
      pgTable,
      text,
      timestamp,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/**
 * Better Auth core tables (user / session / account / verification) plus the
 * fields added by the admin plugin (`role`, `banned`, `banReason`,
 * `banExpires` on user; `impersonatedBy` on session).
 *
 * Fold decision: these tables replace the old `admins` table entirely —
 * an "admin" is a `user` row with role = "admin" (or an ID listed in
 * ADMIN_USER_IDS). No prod users exist, so the old table is simply dropped.
 * Passwords live in `account.password` as Better Auth scrypt hashes (default).
 *
 * Reconciled against `@better-auth/cli generate` output (auth-schema.generated)
 * — column-for-column identical: nullability, `$onUpdate`, index names.
 *
 * Deliberate drift: `admin_bootstrap` (singleton row, see below) backs the
 * first-admin bootstrap in config/auth.ts — the claim INSERT decides exactly
 * one winner across instances with no cap on later role='admin' rows, so
 * invite redeem and the admin CRUD paths stay unlimited. ADMIN_USER_IDS
 * remains the canonical way to grant/revoke admin access.
 */
export const user = pgTable("user", {
      id: text("id").primaryKey(),
      name: text("name").notNull(),
      email: text("email").notNull().unique(),
      emailVerified: boolean("email_verified").default(false).notNull(),
      image: text("image"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
      // --- admin plugin fields (replaces custom isActive column) ---
      role: text("role"),
      banned: boolean("banned").default(false),
      banReason: text("ban_reason"),
      banExpires: timestamp("ban_expires"),
});

/**
 * First-admin bootstrap singleton: at most one row may ever exist
 * (`CHECK (id = 1)` on the single allowed PK value). The signup that wins
 * `INSERT ... ON CONFLICT DO NOTHING` on id=1 becomes the bootstrap admin;
 * losers stay normal users. `claimedBy` stays NULL at claim time (the user
 * row is INSERTed by Better Auth after the hook returns) — it is backfilled
 * opportunistically, never read for auth decisions.
 */
export const adminBootstrap = pgTable(
      "admin_bootstrap",
      {
            id: integer("id").primaryKey(),
            claimedAt: timestamp("claimed_at", { withTimezone: true })
                  .defaultNow(),
            claimedBy: text("claimed_by").references(() => user.id),
      },
      (table) => [
            check("admin_bootstrap_singleton_chk", sql`${table.id} = 1`),
      ],
);

export const session = pgTable(
      "session",
      {
            id: text("id").primaryKey(),
            expiresAt: timestamp("expires_at").notNull(),
            token: text("token").notNull().unique(),
            createdAt: timestamp("created_at").defaultNow().notNull(),
            updatedAt: timestamp("updated_at")
                  .$onUpdate(() => /* @__PURE__ */ new Date())
                  .notNull(),
            ipAddress: text("ip_address"),
            userAgent: text("user_agent"),
            userId: text("user_id")
                  .notNull()
                  .references(() => user.id, { onDelete: "cascade" }),
            // --- admin plugin (impersonation) ---
            impersonatedBy: text("impersonated_by"),
      },
      (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
      "account",
      {
            id: text("id").primaryKey(),
            accountId: text("account_id").notNull(),
            providerId: text("provider_id").notNull(),
            userId: text("user_id")
                  .notNull()
                  .references(() => user.id, { onDelete: "cascade" }),
            accessToken: text("access_token"),
            refreshToken: text("refresh_token"),
            idToken: text("id_token"),
            accessTokenExpiresAt: timestamp("access_token_expires_at"),
            refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
            scope: text("scope"),
            // scrypt hash (Better Auth default) for credential accounts.
            password: text("password"),
            createdAt: timestamp("created_at").defaultNow().notNull(),
            updatedAt: timestamp("updated_at")
                  .$onUpdate(() => /* @__PURE__ */ new Date())
                  .notNull(),
      },
      (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
      "verification",
      {
            id: text("id").primaryKey(),
            identifier: text("identifier").notNull(),
            value: text("value").notNull(),
            expiresAt: timestamp("expires_at").notNull(),
            createdAt: timestamp("created_at").defaultNow().notNull(),
            updatedAt: timestamp("updated_at")
                  .defaultNow()
                  .$onUpdate(() => /* @__PURE__ */ new Date())
                  .notNull(),
      },
      (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const userRelations = relations(user, ({ many }) => ({
      sessions: many(session),
      accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
      user: one(user, {
            fields: [session.userId],
            references: [user.id],
      }),
}));

export const accountRelations = relations(account, ({ one }) => ({
      user: one(user, {
            fields: [account.userId],
            references: [user.id],
      }),
}));
