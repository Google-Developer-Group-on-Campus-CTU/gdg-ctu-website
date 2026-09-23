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

export const toEventAttendeeResponse = (att: EventAttendeeRecord) => att;

export const createEventAttendeeService = async (
      data: NewEventAttendeeRecord,
) => {
      await checkEventExists(data.eventId);
      await checkAttendeeMembership(data.eventId, data.email);

      const att = await insertEventAttendee(data);

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

      const [atts, total] = await Promise.all([
            eventId
                  ? getEventAttendeesByEventId(eventId, pagination)
                  : getEventAttendees(pagination),
            eventId
                  ? countEventAttendeesByEventId(eventId)
                  : countEventAttendees(),
      ]);

      return {
            attendees: atts.map(toEventAttendeeResponse),
            pagination: getPaginationMeta(pagination, total),
      };
};

export const getEventAttendeeService = async (id: string) => {
      const att = await getEventAttendeeById(id);
      if (!att) {
            throw new AppError(404, "Event attendee not found");
      }

      return toEventAttendeeResponse(att);
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

      return toEventAttendeeResponse(updated);
};

export const deleteEventAttendeeService = async (id: string) => {
      const existing = await getEventAttendeeById(id);
      if (!existing) {
            throw new AppError(404, "Event attendee not found");
      }

      await deleteEventAttendee(id);
};
