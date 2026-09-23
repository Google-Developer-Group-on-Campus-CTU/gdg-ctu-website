import { and, asc, count, eq, sql } from "drizzle-orm";
import { db } from "../../../config/connectDB.js";
import { Pagination } from "../../../utils/pagination.js";
import { eventAttendees } from "./event-attendee.js";

export type EventAttendeeRecord = typeof eventAttendees.$inferSelect;
export type NewEventAttendeeRecord = typeof eventAttendees.$inferInsert;

export const insertEventAttendee = async (data: NewEventAttendeeRecord) => {
      const [att] = await db.insert(eventAttendees).values(data).returning();
      return att;
};

export const getEventAttendees = async (pagination: Pagination) =>
      db
            .select()
            .from(eventAttendees)
            .orderBy(
                  asc(eventAttendees.lastName),
                  asc(eventAttendees.firstName),
            )
            .limit(pagination.limit)
            .offset(pagination.offset);

export const countEventAttendees = async () => {
      const [result] = await db.select({ total: count() }).from(eventAttendees);
      return result.total;
};

export const getEventAttendeesByEventId = async (
      eventId: string,
      pagination: Pagination,
) =>
      db
            .select()
            .from(eventAttendees)
            .where(eq(eventAttendees.eventId, eventId))
            .orderBy(
                  asc(eventAttendees.lastName),
                  asc(eventAttendees.firstName),
            )
            .limit(pagination.limit)
            .offset(pagination.offset);

export const countEventAttendeesByEventId = async (eventId: string) => {
      const [result] = await db
            .select({ total: count() })
            .from(eventAttendees)
            .where(eq(eventAttendees.eventId, eventId));
      return result.total;
};

/** Roster dedupe lookup: case-insensitive email match within one event. */
export const getEventAttendeeByEventAndEmail = async (
      eventId: string,
      email: string,
) => {
      const [att] = await db
            .select({ id: eventAttendees.id })
            .from(eventAttendees)
            .where(
                  and(
                        eq(eventAttendees.eventId, eventId),
                        sql`lower(${eventAttendees.email}) = lower(${email})`,
                  ),
            )
            .limit(1);
      return att;
};

export const getEventAttendeeById = async (id: string) => {
      const [att] = await db
            .select()
            .from(eventAttendees)
            .where(eq(eventAttendees.id, id));
      return att;
};

export const updateEventAttendee = async (
      id: string,
      data: Partial<NewEventAttendeeRecord>,
) => {
      const [att] = await db
            .update(eventAttendees)
            .set(data)
            .where(eq(eventAttendees.id, id))
            .returning();
      return att;
};

export const deleteEventAttendee = async (id: string) => {
      const [att] = await db
            .delete(eventAttendees)
            .where(eq(eventAttendees.id, id))
            .returning();
      return att;
};
