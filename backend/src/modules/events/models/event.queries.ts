import { and, asc, count, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "../../../config/connectDB.js";
import { Pagination } from "../../../utils/pagination.js";
import { events } from "./event.js";

export type EventRecord = typeof events.$inferSelect;
export type NewEventRecord = typeof events.$inferInsert;

export const insertEvent = async (data: NewEventRecord) => {
      const [event] = await db.insert(events).values(data).returning();
      return event;
};

export const getEvents = async (pagination: Pagination) =>
      db
            .select()
            .from(events)
            .orderBy(desc(events.startAt), desc(events.createdAt))
            .limit(pagination.limit)
            .offset(pagination.offset);

export const countEvents = async () => {
      const [result] = await db.select({ total: count() }).from(events);
      return result.total;
};

export const getEventById = async (id: string) => {
      const [event] = await db.select().from(events).where(eq(events.id, id));
      return event;
};

export const getEventBySlug = async (slug: string) => {
      const [event] = await db
            .select()
            .from(events)
            .where(eq(events.slug, slug));
      return event;
};

export const getPublishedEventBySlug = async (slug: string) => {
      const [event] = await db
            .select()
            .from(events)
            .where(and(eq(events.slug, slug), eq(events.status, "published")));
      return event;
};

/** Public upcoming feed: published + active + endAt >= now, soonest first. */
export const getPublicUpcomingEvents = async (limit = 50) =>
      db
            .select()
            .from(events)
            .where(
                  and(
                        eq(events.status, "published"),
                        eq(events.isActive, true),
                        gte(events.endAt, new Date()),
                  ),
            )
            .orderBy(asc(events.startAt))
            .limit(limit);

/** Public past feed: published + active + endAt < now, most recent first. */
export const getPublicPastEvents = async (limit = 50) =>
      db
            .select()
            .from(events)
            .where(
                  and(
                        eq(events.status, "published"),
                        eq(events.isActive, true),
                        lt(events.endAt, new Date()),
                  ),
            )
            .orderBy(desc(events.endAt))
            .limit(limit);

/**
 * Public recent feed (Home): upcoming-first up to `limit`,
 * backfilling with past events when upcoming is short.
 */
export const getPublicRecentEvents = async (limit = 3) => {
      const upcoming = await getPublicUpcomingEvents(limit);
      if (upcoming.length >= limit) return upcoming.slice(0, limit);
      const past = await getPublicPastEvents(limit - upcoming.length);
      return [...upcoming, ...past];
};

export const updateEvent = async (
      id: string,
      data: Partial<NewEventRecord>,
) => {
      const [event] = await db
            .update(events)
            .set(data)
            .where(eq(events.id, id))
            .returning();
      return event;
};

export const deleteEvent = async (id: string) => {
      const [event] = await db
            .delete(events)
            .where(eq(events.id, id))
            .returning();
      return event;
};
