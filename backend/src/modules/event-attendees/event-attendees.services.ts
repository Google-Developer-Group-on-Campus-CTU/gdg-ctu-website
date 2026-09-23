import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import {
      insertEventAttendee,
      getEventAttendees,
      countEventAttendees,
      getEventAttendeesByEventId,
      countEventAttendeesByEventId,
      getEventAttendeeById,
      updateEventAttendee,
      deleteEventAttendee,
} from "./models/event-attendee.queries.js";
import { NewEventAttendeeRecord } from "./models/event-attendee.queries.js";
import { EventAttendeeRecord } from "./event-attendees.validations.js";
import {
      checkAttendeeMembership,
      checkEventExists,
} from "../event-roster/event-roster.services.js";
import {
      getCache,
      setCache,
      deleteCache,
      clearCacheByPrefix,
} from "../../config/redis/redis.services.js";

// Cache TTL in seconds for setCache (its ttl parameter is seconds, not ms)
const DEFAULT_CACHE_TTL_SECONDS = 60;
export const toEventAttendeeResponse = (att: EventAttendeeRecord) => att;

export const createEventAttendeeService = async (
      data: NewEventAttendeeRecord,
) => {
      await checkEventExists(data.eventId);
      await checkAttendeeMembership(data.eventId, data.email);

      const att = await insertEventAttendee(data);

      await clearCacheByPrefix(`attendees:`);
      return toEventAttendeeResponse(att);
};

export const listEventAttendeesService = async (
      pagination: Pagination,
      eventId?: string,
) => {
      // Optional ?eventId filter: 404 when the event does not exist.
      if (eventId) {
            await checkEventExists(eventId);
      }

      // Per-event keys share the `attendees:` prefix so existing
      // clearCacheByPrefix("attendees:") invalidation covers them.
      const cacheKey = eventId
            ? `attendees:event:${eventId}:${pagination.page}:${pagination.limit}`
            : `attendees:${pagination.page}:${pagination.limit}`;

      // Check Cache
      const cached = await getCache<{
            attendees: EventAttendeeRecord[];
            pagination: ReturnType<typeof getPaginationMeta>;
      }>(cacheKey);

      if (cached) return cached;

      // Cache Miss
      const [atts, total] = await Promise.all([
            eventId
                  ? getEventAttendeesByEventId(eventId, pagination)
                  : getEventAttendees(pagination),
            eventId
                  ? countEventAttendeesByEventId(eventId)
                  : countEventAttendees(),
      ]);

      const res = {
            attendees: atts.map(toEventAttendeeResponse),
            pagination: getPaginationMeta(pagination, total),
      };

      await setCache(cacheKey, res, DEFAULT_CACHE_TTL_SECONDS);
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
      await setCache(cacheKey, res, DEFAULT_CACHE_TTL_SECONDS);

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

      // Re-run integrity checks only when eventId or email change.
      const nextEventId = data.eventId ?? existing.eventId;
      const nextEmail = data.email ?? existing.email;
      const referenceChanged =
            (data.eventId !== undefined &&
                  data.eventId !== existing.eventId) ||
            (data.email !== undefined &&
                  data.email.toLowerCase() !== existing.email.toLowerCase());

      if (referenceChanged) {
            await checkEventExists(nextEventId);
            await checkAttendeeMembership(nextEventId, nextEmail);
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
