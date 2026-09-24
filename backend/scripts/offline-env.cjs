/**
 * Offline CI defaults for scripts that load code importing `src/config/env`
 * (the smoke test, the drizzle-generate driver) on machines with no
 * `backend/.env` — e.g. GitHub Actions.
 *
 * Only fills variables that are UNSET in the process environment. This runs
 * before dotenv loads, so these take precedence over a local `backend/.env`
 * for the listed keys — harmless: the values only satisfy import-time
 * validation and are never connected to (smoke asserts route mounts,
 * generate diffs schema files against the drizzle snapshot).
 */
process.env.NODE_ENV ||= "production"; // console-only logger, no logs/ writes
process.env.PORT ||= "3000"; // required by EnvSchema; unused offline
process.env.DB_URL ||= "postgresql://localhost:5432/offline"; // schema-valid URL; never connected
process.env.FR_ORIGIN ||= "http://localhost:5173";
process.env.BETTER_AUTH_SECRET ||= "offline-secret-not-for-production";
process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
