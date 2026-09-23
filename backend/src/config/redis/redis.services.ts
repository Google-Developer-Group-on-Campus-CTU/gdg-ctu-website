import { createClient, RedisClientType } from "redis";
import logger from "../../utils/logger.js";
import { AppError } from "../../utils/http.js";
import { isRedisEnabled } from "./redis.config.js";

export { isRedisEnabled };

/**
 * Reusable Redis client instance.
 * The client is created lazily and shared across the entire backend.
 * It connects on first use and stays connected for the lifetime of the process.
 */
let client: RedisClientType<any, any> | null = null;

/**
 * Ensure a connected Redis client. If the client has not been instantiated yet,
 * it will be created and connected. Subsequent calls reuse the existing
 * connection.
 */
async function getClient(): Promise<RedisClientType<any, any>> {
      if (!isRedisEnabled()) {
            throw new AppError(
                  503,
                  "Cache service unavailable: Redis is not configured",
            );
      }
      if (!client) {
            client = createClient({
                  url: process.env.REDIS_URL,
            });
            client.on("error", (err) => {
                  logger.error("Redis client error", { error: err });
            });

            try {
                  await client.connect();
            } catch (error: any) {
                  logger.error("Failed to connect to Redis", {
                        message: error.message,
                        stack: error.stack,
                  });
                  // Wrap the low‑level error in our AppError for consistent error handling.
                  throw new AppError(
                        500,
                        "Failed to establish Redis connection",
                  );
            }
      }
      return client;
}

/**
 * Retrieve a cached value.
 *
 * @param key The cache key.
 * @returns The parsed value if present, otherwise `null`.
 *
 * @example
 * ```ts
 * // Example: cache paginated team members list
 * const cacheKey = `teamMembers:${page}:${limit}`;
 * let result = await getCache<{ teamMembers: any[]; pagination: any }>(cacheKey);
 * if (!result) {
 *   // Fallback to service (DB) when cache miss
 *   result = await getTeamMembersService({ limit, offset: (page - 1) * limit });
 *   await setCache(cacheKey, result, 300); // cache for 5 minutes
 * }
 * // `result.teamMembers` is now available without another DB hit
 * ```
 */
export async function getCache<T>(key: string): Promise<T | null> {
      // Graceful no-op when Redis is disabled: cache miss -> callers fall through to DB.
      if (!isRedisEnabled()) {
            return null;
      }
      const c = await getClient();
      const raw = await c.get(key);
      if (raw === null) return null;
      try {
            // Assume JSON‑serialised objects for non‑string values.
            return JSON.parse(raw) as T;
      } catch {
            // If parsing fails, fall back to the raw string value.
            return raw as unknown as T;
      }
}

/**
 * Store a value in Redis.
 *
 * @param key   The cache key.
 * @param value The value to cache – will be JSON‑stringified unless it is already a string.
 * @param ttlSeconds Optional time‑to‑live in seconds. If omitted, the key persists until explicitly deleted.
 *
 * @example
 * ```ts
 * // Cache the result of a DB call for 10 minutes
 * const result = await expensiveQuery();
 * await setCache("expensive:result", result, 600);
 * ```
 */
export async function setCache<T>(
      key: string,
      value: T,
      ttlSeconds?: number,
): Promise<void> {
      // Graceful no-op when Redis is disabled.
      if (!isRedisEnabled()) {
            logger.debug("Redis disabled - skipping setCache");
            return;
      }
      const c = await getClient();
      const serialized =
            typeof value === "string" ? value : JSON.stringify(value);
      if (ttlSeconds) {
            await c.set(key, serialized, { EX: ttlSeconds });
      } else {
            await c.set(key, serialized);
      }
}

/**
 * Delete a cache entry.
 *
 * @param key The cache key to remove.
 *
 * @example
 * ```ts
 * // Invalidate a stale cache after an update
 * await deleteCache("admins:list");
 * ```
 */
export async function deleteCache(key: string): Promise<void> {
      // Graceful no-op when Redis is disabled.
      if (!isRedisEnabled()) {
            logger.debug("Redis disabled - skipping deleteCache");
            return;
      }
      const c = await getClient();
      await c.del(key);
}

/**
 * Delete all keys that start with the given prefix.
 *
 * Useful for invalidating a family of cached entries (e.g., all paginated
 * admin list caches). It uses the Redis `keys` command, which is acceptable for a
 * modest cache size.
 */
export async function clearCacheByPrefix(prefix: string): Promise<void> {
      // Graceful no-op when Redis is disabled.
      if (!isRedisEnabled()) {
            logger.debug("Redis disabled - skipping clearCacheByPrefix");
            return;
      }
      const c = await getClient();
      const keys = await c.keys(`${prefix}*`);
      if (keys.length > 0) {
            await c.del(keys);
      }
}
