import { count, eq } from "drizzle-orm";
import { db } from "../../../config/connectDB.js";
import { Pagination } from "../../../utils/pagination.js";
import { events } from "../../events/models/event.js";
import { memberTerms } from "../../member_terms/models/member-terms.js";
import { teamMembers } from "../../team-members/models/team-member.js";
import { media } from "./media.js";

export type MediaRecord = typeof media.$inferSelect;
export type NewMediaRecord = typeof media.$inferInsert;

export const insertMedia = async (data: NewMediaRecord) => {
      const [record] = await db.insert(media).values(data).returning();
      return record;
};

/**
 * This query is the counter part of insertBulkMediaService
 */
export const insertBulkMedia = async (bulkRecords: NewMediaRecord[]) => {
      const records = await db
            .insert(media)
            .values(bulkRecords)
            .returning({ id: media.id });

      return records;
};

export const getMedia = async (pagination: Pagination) =>
      db.select().from(media).limit(pagination.limit).offset(pagination.offset);

export const countMedia = async () => {
      const [result] = await db.select({ total: count() }).from(media);
      return result.total;
};

export const getMediaById = async (id: string) => {
      const [record] = await db.select().from(media).where(eq(media.id, id));
      return record;
};

export const updateMedia = async (
      id: string,
      data: Partial<NewMediaRecord>,
) => {
      const [record] = await db
            .update(media)
            .set(data)
            .where(eq(media.id, id))
            .returning();
      return record;
};

export const deleteMedia = async (id: string) => {
      const [record] = await db
            .delete(media)
            .where(eq(media.id, id))
            .returning();
      return record;
};

export const mediaHasReferences = async (id: string) => {
      const [teamMember] = await db
            .select({ id: teamMembers.id })
            .from(teamMembers)
            .where(eq(teamMembers.profileMediaId, id))
            .limit(1);

      const [event] = await db
            .select({ id: events.id })
            .from(events)
            .where(eq(events.coverMediaId, id))
            .limit(1);

      const [memberTerm] = await db
            .select({ id: memberTerms.id })
            .from(memberTerms)
            .where(eq(memberTerms.profileMediaId, id))
            .limit(1);

      return Boolean(teamMember || event || memberTerm);
};
