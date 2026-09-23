import { createClient } from "redis";
import logger from "../../utils/logger.js";
import { AppError } from "../../utils/http.js";

/**
 * Returns true iff REDIS_URL is configured (non-empty string).
 * When false, Redis is treated as disabled and all cache operations
 * become graceful no-ops so the server can boot without Redis.
 */
export function isRedisEnabled(): boolean {
      const url = process.env.REDIS_URL;
      return typeof url === "string" && url.trim().length > 0;
}

/**
 * The sole purpose of this function is to test connectivity to redis.
 * No-ops when REDIS_URL is not configured so the server can boot
 * without Redis.
 */
export const testRedisConnection = async () => {
      if (!isRedisEnabled()) {
            logger.warn("Redis disabled - skipping connection test");
            return false;
      }
      try {
            const client = createClient({
                  url: process.env.REDIS_URL,
            });

            await client.connect();
            const ping = await client.ping();

            if (ping === "PONG") {
                  logger.info("Redis Connection Established Successfully.");
            }

            // Safely close the connection since this is just a test.
            await client.disconnect();
            return true;
      } catch (error: any) {
            logger.error("Failed to Connect Redis", {
                  message: error.message,
                  stack: error.stack,
            });
            throw new AppError(
                  500,
                  "An Error has Occured: Failed to Establish Redis Connection",
            );
      }
};
