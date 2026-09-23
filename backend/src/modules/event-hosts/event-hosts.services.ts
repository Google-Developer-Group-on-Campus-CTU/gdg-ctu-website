import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import {
      insertEventHost,
      getEventHosts,
      countEventHosts,
      getEventHostById,
      updateEventHost,
      deleteEventHost,
} from "./models/event-host.queries.js";
import { EventHostRecord } from "./event-hosts.validations.js";
import { NewEventHostRecord } from "./models/event-host.queries.js";
import {
      getCache,
      setCache,
      deleteCache,
      clearCacheByPrefix,
} from "../../config/redis/redis.services.js";

// Constant value for cache timeout
const DEFAULT_CACHE_TIME_TO_LIVE = 60000;
export const toEventHostResponse = (host: EventHostRecord) => {
      // No sensitive fields to strip currently
      return host;
};

export const createEventHostService = async (data: NewEventHostRecord) => {
      const host = await insertEventHost(data);

      await clearCacheByPrefix(`hosts:`);
      return toEventHostResponse(host);
};

export const listEventHostsService = async (pagination: Pagination) => {
      const cacheKey = `hosts:${pagination.page}:${pagination.limit}`;

      // Check Cache
      const cached = await getCache<{
            hosts: EventHostRecord[];
            pagination: ReturnType<typeof getPaginationMeta>;
      }>(cacheKey);

      if (cached) return cached;

      // Cache Miss
      const [hosts, total] = await Promise.all([
            getEventHosts(pagination),
            countEventHosts(),
      ]);

      const res = {
            hosts: hosts.map(toEventHostResponse),
            pagination: getPaginationMeta(pagination, total),
      };

      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);
      return res;
};

export const getEventHostService = async (id: string) => {
      const cacheKey = `hosts:${id}`;
      const cachedHost = await getCache<EventHostRecord>(cacheKey);
      if (cachedHost) return cachedHost;

      const host = await getEventHostById(id);
      if (!host) {
            throw new AppError(404, "Event host not found");
      }

      const res = toEventHostResponse(host);
      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);

      return res;
};

export const updateEventHostService = async (
      id: string,
      data: Partial<NewEventHostRecord>,
) => {
      const existing = await getEventHostById(id);
      if (!existing) {
            throw new AppError(404, "Event host not found");
      }
      const updated = await updateEventHost(id, data);

      await deleteCache(`hosts:${id}`);
      await clearCacheByPrefix("hosts:");

      return toEventHostResponse(updated);
};

export const deleteEventHostService = async (id: string) => {
      const existing = await getEventHostById(id);
      if (!existing) {
            throw new AppError(404, "Event host not found");
      }

      await deleteCache(`hosts:${id}`);
      await clearCacheByPrefix("hosts:");
      await deleteEventHost(id);
};
