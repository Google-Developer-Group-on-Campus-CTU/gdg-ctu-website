import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import ENV from "./env.js";
import logger from "../utils/logger.js";

/**
 * Serverless-safe Postgres pool — DB_URL must be the Neon *pooled pooler*
 * connection string (…-pooler.<region>.neon.tech), not the direct one.
 *
 * - ONE module-level Pool per container: Vercel reuses this module across
 *   invocations, so a cold start builds it once and every warm request shares
 *   the same instance. Request handlers must never `new Pool()` — one pool
 *   per request is the classic serverless connection-exhaustion bug.
 * - The constructor performs no I/O; pg opens the first connection lazily on
 *   the first query, so importing this module costs nothing on a cold start.
 * - `max: 2` (not 1): redeemAdminInviteService's transaction holds one
 *   checked-out client while Better Auth's adapter writes user/account rows
 *   through the shared pool on a second connection (see the note there) —
 *   max: 1 would deadlock that flow against `connectionTimeoutMillis`. 2 also
 *   covers the adapter's own transaction paths and stays far under Neon's
 *   per-instance limits.
 * - `connectionTimeoutMillis`: bounds how long a queued query waits for a free
 *   client, so pile-ups fail fast instead of hanging until the platform kills
 *   the function.
 * - `idleTimeoutMillis` + `allowExitOnIdle`: a warm container releases its
 *   idle backend and never keeps the event loop alive by itself (the HTTP
 *   server handle does that while listening).
 */
const pool = new Pool({
      connectionString: ENV.DB_URL,
      max: 2,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
      allowExitOnIdle: true,
});

// Idle-backend failures (pooler restart, server-side idle close) surface as
// an 'error' event on the Pool; without a listener pg rethrows them and would
// crash the warm container the next time it is reused.
pool.on("error", (err) => {
      logger.error("Postgres pool idle-client error", { message: err.message });
});

// No `schema` option here: it used to `import * from "../modules/index.js"`, which
// pulled the route router into this module (an import cycle once config/auth
// was added) and never contained real tables anyway — relational `db.query.*`
// is unused, and Better Auth gets its schema explicitly in config/auth.ts.
export const db = drizzle({
      client: pool,
});

/**
 * Boot-time connectivity check (all-or-nothing: a dead DB fails the boot).
 *
 * Migrations are intentionally NOT run at boot — serverless cold starts must
 * never migrate, and CI has no live DB. Apply them manually against a live
 * DB_URL with:
 *
 *     npm run db:migrate
 */
export const connectDB = async () => {
      await pool.query("SELECT 1");
      return logger.info("Server Connected to Database Successfully");
};
