import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import {
      insertEventAttendee,
      getEventAttendees,
      countEventAttendees,
      getEventAttendeeById,
      updateEventAttendee,
      deleteEventAttendee,
} from "./models/event-attendee.queries.js";
import { NewEventAttendeeRecord } from "./models/event-attendee.queries.js";
import { EventAttendeeRecord } from "./event-attendees.validations.js";
import {
      getCache,
      setCache,
      deleteCache,
      clearCacheByPrefix,
} from "../../config/redis/redis.services.js";

// Constant value for cache timeout
const DEFAULT_CACHE_TIME_TO_LIVE = 60000;
export const toEventAttendeeResponse = (att: EventAttendeeRecord) => att;

export const createEventAttendeeService = async (
      data: NewEventAttendeeRecord,
) => {
      const att = await insertEventAttendee(data);

      await clearCacheByPrefix(`attendees:`);
      return toEventAttendeeResponse(att);
};

export const listEventAttendeesService = async (pagination: Pagination) => {
      const cacheKey = `attendees:${pagination.page}:${pagination.limit}`;

      // Check Cache
      const cached = await getCache<{
            attendees: EventAttendeeRecord[];
            pagination: ReturnType<typeof getPaginationMeta>;
      }>(cacheKey);

      if (cached) return cached;

      // Cache Miss
      const [atts, total] = await Promise.all([
            getEventAttendees(pagination),
            countEventAttendees(),
      ]);

      const res = {
            attendees: atts.map(toEventAttendeeResponse),
            pagination: getPaginationMeta(pagination, total),
      };

      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);
      return res;
};

export const getEventAttendeeService = async (id: string) => {
      const cacheKey = `attendees:${id}`;
      const cachedAttendee = await getCache<EventAttendeeRecord>(cacheKey);
      if (cachedAttendee) return cachedAttendee;

      const att = await getEventAttendeeById(id);
      if (!att) {
            throw new AppError(404, "Event attendee not found");
      }

      const res = toEventAttendeeResponse(att);
      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);

      return res;
};

export const updateEventAttendeeService = async (
      id: string,
      data: Partial<NewEventAttendeeRecord>,
) => {
      const existing = await getEventAttendeeById(id);
      if (!existing) {
            throw new AppError(404, "Event attendee not found");
      }
      const updated = await updateEventAttendee(id, data);

      await deleteCache(`attendees:${id}`);
      await clearCacheByPrefix(`attendees:`);

      return toEventAttendeeResponse(updated);
};

export const deleteEventAttendeeService = async (id: string) => {
      const existing = await getEventAttendeeById(id);
      if (!existing) {
            throw new AppError(404, "Event attendee not found");
      }

      await deleteCache(`attendees:${id}`);
      await clearCacheByPrefix(`attendees:`);
      await deleteEventAttendee(id);
};
