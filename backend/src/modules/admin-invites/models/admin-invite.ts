import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Single-use admin invite links.
 *
 * The raw token is returned exactly once — in the 201 body of
 * POST /admin-invites — and never persisted. Only its sha256 hex digest
 * (fixed 64-char string) is stored, so every comparison happens on
 * equal-length hex and a DB leak cannot recover a usable token.
 *
 * `createdBy` / `usedBy` hold Better Auth `user` ids (text, matching the
 * audit-column convention folded in the Clerk → Better Auth migration).
 * Deliberately no FK: invite rows are ephemeral and must not block user
 * deletion, and the user table is Better Auth-owned.
 *
 * Timestamps are timestamptz per spec (72h expiry must be absolute time).
 */
export const adminInvites = pgTable("admin_invites", {
      id: uuid("id").defaultRandom().primaryKey(),
      tokenHash: text("token_hash").notNull().unique(),
      createdBy: text("created_by").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      usedAt: timestamp("used_at", { withTimezone: true }),
      usedBy: text("used_by"),
});
