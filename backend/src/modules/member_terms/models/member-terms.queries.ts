import { asc, count, eq, and } from "drizzle-orm";
import { db } from "../../../config/connectDB";
import { Pagination } from "../../../utils/pagination";
import { memberTerms } from "./member-terms";

export type MemberTermsRecord = typeof memberTerms.$inferSelect;
export type NewMemberTermsRecord = typeof memberTerms.$inferInsert;

export const createMemberTerm = async (data: NewMemberTermsRecord) => {
      const [memberTerm] = await db
            .insert(memberTerms)
            .values(data)
            .returning();
      return memberTerm;
};

export const countMemberTerms = async () => {
      const [result] = await db.select({ total: count() }).from(memberTerms);
      return result.total;
};

export const getMemberTerms = async (pagination: Pagination) =>
      db
            .select()
            .from(memberTerms)
            .orderBy(asc(memberTerms.displayOrder))
            .limit(pagination.limit)
            .offset(pagination.offset);

export const getMemberTermById = async (id: string) => {
      const [memberTerm] = await db
            .select()
            .from(memberTerms)
            .where(eq(memberTerms.id, id));
      return memberTerm;
};

export const getMemberTermByMemberAndTerm = async (
      memberId: string,
      termId: string,
) => {
      const [memberTerm] = await db
            .select()
            .from(memberTerms)
            .where(
                  and(
                        eq(memberTerms.memberId, memberId),
                        eq(memberTerms.termId, termId),
                  ),
            )
            .limit(1);
      return memberTerm;
};

export const updateMemberTerm = async (
      id: string,
      data: Partial<NewMemberTermsRecord>,
) => {
      const [memberTerm] = await db
            .update(memberTerms)
            .set(data)
            .where(eq(memberTerms.id, id))
            .returning();
      return memberTerm;
};

export const deleteMemberTerm = async (id: string) => {
      const [memberTerm] = await db
            .delete(memberTerms)
            .where(eq(memberTerms.id, id))
            .returning();
      return memberTerm;
};
