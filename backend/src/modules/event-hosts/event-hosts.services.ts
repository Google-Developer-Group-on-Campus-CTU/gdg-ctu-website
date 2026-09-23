import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import {
      insertEventHost,
      getEventHosts,
      countEventHosts,
      getEventHostsByEventId,
      countEventHostsByEventId,
      getEventHostById,
      updateEventHost,
      deleteEventHost,
} from "./models/event-host.queries.js";
import { EventHostRecord } from "./event-hosts.validations.js";
import { NewEventHostRecord } from "./models/event-host.queries.js";
import {
      checkEventExists,
      checkHostMembership,
      checkTeamMemberExists,
} from "../event-roster/event-roster.services.js";

export const toEventHostResponse = (host: EventHostRecord) => {
      // No sensitive fields to strip currently
      return host;
};

export const createEventHostService = async (data: NewEventHostRecord) => {
      await checkEventExists(data.eventId);
      await checkTeamMemberExists(data.teamMemberId);
      await checkHostMembership(data.eventId, data.teamMemberId);

      const host = await insertEventHost(data);

      return toEventHostResponse(host);
};

export const listEventHostsService = async (
      pagination: Pagination,
      eventId?: string,
) => {
      // Optional ?eventId filter: 404 when the event does not exist.
      if (eventId) {
            await checkEventExists(eventId);
      }

      const [hosts, total] = await Promise.all([
            eventId
                  ? getEventHostsByEventId(eventId, pagination)
                  : getEventHosts(pagination),
            eventId ? countEventHostsByEventId(eventId) : countEventHosts(),
      ]);

      return {
            hosts: hosts.map(toEventHostResponse),
            pagination: getPaginationMeta(pagination, total),
      };
};

export const getEventHostService = async (id: string) => {
      const host = await getEventHostById(id);
      if (!host) {
            throw new AppError(404, "Event host not found");
      }

      return toEventHostResponse(host);
};

export const updateEventHostService = async (
      id: string,
      data: Partial<NewEventHostRecord>,
) => {
      const existing = await getEventHostById(id);
      if (!existing) {
            throw new AppError(404, "Event host not found");
      }

      // Re-run integrity checks only when the FK references change.
      const nextEventId = data.eventId ?? existing.eventId;
      const nextTeamMemberId = data.teamMemberId ?? existing.teamMemberId;
      const referencesChanged =
            (data.eventId !== undefined &&
                  data.eventId !== existing.eventId) ||
            (data.teamMemberId !== undefined &&
                  data.teamMemberId !== existing.teamMemberId);

      if (referencesChanged) {
            await checkEventExists(nextEventId);
            await checkTeamMemberExists(nextTeamMemberId);
            await checkHostMembership(nextEventId, nextTeamMemberId);
      }

      const updated = await updateEventHost(id, data);

      return toEventHostResponse(updated);
};

export const deleteEventHostService = async (id: string) => {
      const existing = await getEventHostById(id);
      if (!existing) {
            throw new AppError(404, "Event host not found");
      }

      await deleteEventHost(id);
};
