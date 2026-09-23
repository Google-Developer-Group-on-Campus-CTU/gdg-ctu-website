import { and, asc, count, desc, eq } from "drizzle-orm";
import { db } from "../../../config/connectDB";
import { Pagination } from "../../../utils/pagination";
import { activeByKey, activeOnly } from "../../../utils/activeScope";
import { eventSpeakers } from "../../event-speakers/models/event-speaker";
import { media } from "../../media/models/media";
import { memberTerms } from "../../member_terms/models/member-terms";
import { terms } from "../../terms/models/terms";
import { teamMembers } from "./team-member";

export type TeamMemberRecord = typeof teamMembers.$inferSelect;
export type NewTeamMemberRecord = typeof teamMembers.$inferInsert;

export const insertTeamMember = async (
      data: NewTeamMemberRecord,
      profilePictureId: string,
) => {
      const [teamMember] = await db
            .insert(teamMembers)
            .values({
                  ...data,
                  ...(profilePictureId
                        ? { profileMediaId: profilePictureId }
                        : {}),
            })
            .returning();
      return teamMember;
};

export const getTeamMembers = async (pagination: Pagination) =>
      db
            .select()
            .from(teamMembers)
            .orderBy(asc(teamMembers.displayOrder), asc(teamMembers.lastName))
            .limit(pagination.limit)
            .offset(pagination.offset);

export const countTeamMembers = async () => {
      const [result] = await db.select({ total: count() }).from(teamMembers);
      return result.total;
};

export const getTeamMemberById = async (id: string) => {
      const [teamMember] = await db
            .select()
            .from(teamMembers)
            .where(eq(teamMembers.id, id));
      return teamMember;
};

export const getTeamMemberBySlug = async (slug: string) => {
      const [teamMember] = await db
            .select()
            .from(teamMembers)
            .where(eq(teamMembers.slug, slug));
      return teamMember;
};

/** Public feed: active members only (safe fields projected by the controller). */
export const getActiveTeamMembers = async (featuredOnly = false) => {
      const where = featuredOnly
            ? and(
                    activeOnly(teamMembers.isActive),
                    eq(teamMembers.isFeatured, true),
              )
            : activeOnly(teamMembers.isActive);
      return db
            .select({
                  id: teamMembers.id,
                  firstName: teamMembers.firstName,
                  lastName: teamMembers.lastName,
                  slug: teamMembers.slug,
                  bio: teamMembers.bio,
                  department: teamMembers.department,
                  program: teamMembers.program,
                  yearSection: teamMembers.yearSection,
                  profileMediaId: teamMembers.profileMediaId,
                  profileSecureUrl: media.secureUrl,
                  profileAltText: media.altText,
                  linkedinUrl: teamMembers.linkedinUrl,
                  githubUrl: teamMembers.githubUrl,
                  websiteUrl: teamMembers.websiteUrl,
                  isFeatured: teamMembers.isFeatured,
                  displayOrder: teamMembers.displayOrder,
            })
            .from(teamMembers)
            .leftJoin(media, eq(media.id, teamMembers.profileMediaId))
            .where(where)
            .orderBy(asc(teamMembers.displayOrder), asc(teamMembers.lastName));
};

export const getActiveTeamMemberBySlug = async (slug: string) => {
      const [teamMember] = await db
            .select({
                  id: teamMembers.id,
                  firstName: teamMembers.firstName,
                  lastName: teamMembers.lastName,
                  slug: teamMembers.slug,
                  bio: teamMembers.bio,
                  department: teamMembers.department,
                  program: teamMembers.program,
                  yearSection: teamMembers.yearSection,
                  profileMediaId: teamMembers.profileMediaId,
                  profileSecureUrl: media.secureUrl,
                  profileAltText: media.altText,
                  linkedinUrl: teamMembers.linkedinUrl,
                  githubUrl: teamMembers.githubUrl,
                  websiteUrl: teamMembers.websiteUrl,
                  isFeatured: teamMembers.isFeatured,
                  displayOrder: teamMembers.displayOrder,
                  isActive: teamMembers.isActive,
                  createdAt: teamMembers.createdAt,
                  updatedAt: teamMembers.updatedAt,
            })
            .from(teamMembers)
            .leftJoin(media, eq(media.id, teamMembers.profileMediaId))
            .where(activeByKey(teamMembers.slug, teamMembers.isActive, slug));
      return teamMember;
};

interface PublicTeamTermFilter {
      termId?: string;
      termName?: string;
      currentOnly?: boolean;
      featuredOnly?: boolean;
}

const termRosterWhere = ({
      termId,
      termName,
      currentOnly,
      featuredOnly,
}: PublicTeamTermFilter) => {
      const filters = [
            activeOnly(teamMembers.isActive),
            activeOnly(memberTerms.isActive),
      ];

      if (featuredOnly) filters.push(eq(teamMembers.isFeatured, true));
      if (termId) filters.push(eq(memberTerms.termId, termId));
      if (termName) filters.push(eq(terms.name, termName));
      if (currentOnly) filters.push(eq(terms.isCurrent, true));

      return and(...filters);
};

/**
 * Public term roster: the term assignment owns historical role/avatar data.
 * Member-level profile media remains a fallback for legacy rows.
 */
export const getActiveTeamMembersByTerm = async (
      filter: PublicTeamTermFilter,
) =>
      db
            .select({
                  id: teamMembers.id,
                  firstName: teamMembers.firstName,
                  lastName: teamMembers.lastName,
                  slug: teamMembers.slug,
                  role: memberTerms.role,
                  bio: teamMembers.bio,
                  department: teamMembers.department,
                  program: teamMembers.program,
                  yearSection: teamMembers.yearSection,
                  profileMediaId: memberTerms.profileMediaId,
                  fallbackProfileMediaId: teamMembers.profileMediaId,
                  profileSecureUrl: media.secureUrl,
                  profileAltText: media.altText,
                  termId: memberTerms.termId,
                  termName: terms.name,
                  linkedinUrl: teamMembers.linkedinUrl,
                  githubUrl: teamMembers.githubUrl,
                  websiteUrl: teamMembers.websiteUrl,
                  isFeatured: teamMembers.isFeatured,
                  displayOrder: memberTerms.displayOrder,
            })
            .from(memberTerms)
            .innerJoin(teamMembers, eq(teamMembers.id, memberTerms.memberId))
            .innerJoin(terms, eq(terms.id, memberTerms.termId))
            .leftJoin(media, eq(media.id, memberTerms.profileMediaId))
            .where(termRosterWhere(filter))
            .orderBy(
                  desc(terms.startDate),
                  asc(memberTerms.displayOrder),
                  asc(teamMembers.lastName),
            );

export const updateTeamMember = async (
      id: string,
      data: Partial<NewTeamMemberRecord>,
) => {
      const [teamMember] = await db
            .update(teamMembers)
            .set(data)
            .where(eq(teamMembers.id, id))
            .returning();
      return teamMember;
};

export const deleteTeamMember = async (id: string) => {
      const [teamMember] = await db
            .delete(teamMembers)
            .where(eq(teamMembers.id, id))
            .returning();
      return teamMember;
};

export const teamMemberHasEventSpeakerReferences = async (id: string) => {
      const [speaker] = await db
            .select({ id: eventSpeakers.id })
            .from(eventSpeakers)
            .where(eq(eventSpeakers.teamMemberId, id))
            .limit(1);

      return Boolean(speaker);
};
