import { and, asc, count, eq } from "drizzle-orm";
import { db } from "../../../config/connectDB.js";
import { Pagination } from "../../../utils/pagination.js";
import { eventHosts } from "./event-host.js";

export type EventHostRecord = typeof eventHosts.$inferSelect;
export type NewEventHostRecord = typeof eventHosts.$inferInsert;

export const insertEventHost = async (data: NewEventHostRecord) => {
      const [host] = await db.insert(eventHosts).values(data).returning();
      return host;
};

export const getEventHosts = async (pagination: Pagination) =>
      db
            .select()
            .from(eventHosts)
            .orderBy(asc(eventHosts.displayOrder))
            .limit(pagination.limit)
            .offset(pagination.offset);

export const countEventHosts = async () => {
      const [result] = await db.select({ total: count() }).from(eventHosts);
      return result.total;
};

export const getEventHostsByEventId = async (
      eventId: string,
      pagination: Pagination,
) =>
      db
            .select()
            .from(eventHosts)
            .where(eq(eventHosts.eventId, eventId))
            .orderBy(asc(eventHosts.displayOrder))
            .limit(pagination.limit)
            .offset(pagination.offset);

export const countEventHostsByEventId = async (eventId: string) => {
      const [result] = await db
            .select({ total: count() })
            .from(eventHosts)
            .where(eq(eventHosts.eventId, eventId));
      return result.total;
};

/** Roster dedupe lookup: does this team member already host this event? */
export const getEventHostByEventAndTeamMember = async (
      eventId: string,
      teamMemberId: string,
) => {
      const [host] = await db
            .select({ id: eventHosts.id })
            .from(eventHosts)
            .where(
                  and(
                        eq(eventHosts.eventId, eventId),
                        eq(eventHosts.teamMemberId, teamMemberId),
                  ),
            )
            .limit(1);
      return host;
};

export const getEventHostById = async (id: string) => {
      const [host] = await db
            .select()
            .from(eventHosts)
            .where(eq(eventHosts.id, id));
      return host;
};

export const updateEventHost = async (
      id: string,
      data: Partial<NewEventHostRecord>,
) => {
      const [host] = await db
            .update(eventHosts)
            .set(data)
            .where(eq(eventHosts.id, id))
            .returning();
      return host;
};

export const deleteEventHost = async (id: string) => {
      const [host] = await db
            .delete(eventHosts)
            .where(eq(eventHosts.id, id))
            .returning();
      return host;
};
