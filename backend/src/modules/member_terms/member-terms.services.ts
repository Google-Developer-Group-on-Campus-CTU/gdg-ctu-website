import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import {
      createMemberTerm,
      getMemberTerms,
      getMemberTermByMemberAndTerm,
      countMemberTerms,
      getMemberTermById,
      updateMemberTerm,
      deleteMemberTerm,
} from "./models/member-terms.queries.js";
import {
      CreateMemberTermsDTO,
      UpdateMemberTermDTO,
      MemberTerms,
} from "./member-terms.validations.js";
import {
      getCache,
      setCache,
      deleteCache,
      clearCacheByPrefix,
} from "../../config/redis/redis.services.js";
import { getTeamMemberById } from "../team-members/models/team-member.queries.js";
import { getTermById } from "../terms/models/terms.queries.js";
import { getMediaById } from "../media/models/media.queries.js";

// Cache TTL in seconds (setCache's ttl is seconds, not milliseconds)
const DEFAULT_CACHE_TTL_SECONDS = 60;

/**
 * Create a MemberTerm linking a team member to a term.
 * Validates that both the member and term exist before insertion.
 */
export const createMemberTermService = async (data: CreateMemberTermsDTO) => {
      // Verify referenced team member exists
      const member = await getTeamMemberById(data.memberId);
      if (!member) {
            throw new AppError(404, "Team member not found");
      }

      // Verify referenced term exists
      const term = await getTermById(data.termId);
      if (!term) {
            throw new AppError(404, "Term not found");
      }

      // Prevent duplicate member-term assignments
      const existingMemberTerm = await getMemberTermByMemberAndTerm(
            data.memberId,
            data.termId,
      );

      if (existingMemberTerm) {
            throw new AppError(
                  409,
                  "Team member is already assigned to this term",
            );
      }

      if (data.profileMediaId && !(await getMediaById(data.profileMediaId))) {
            throw new AppError(400, "profileMediaId must reference existing media");
      }

      // Invalidate related caches before persisting. member_terms writes
      // seed avatars from the member row, so also drop team-members: caches
      // to avoid an avatar-snapshot staleness window.
      await clearCacheByPrefix("member-terms:");
      await clearCacheByPrefix("team-members:");

      // If callers do not provide a term snapshot yet, seed it from the
      // member's current/default avatar so existing reads remain stable.
      const profileMediaId = data.profileMediaId ?? member.profileMediaId;

      // Insert the record
      return createMemberTerm({ ...data, profileMediaId });
};

/**
 * Retrieve a MemberTerm by memberId and termId.
 * Returns the existing record or null.
 */
export const getMemberTermByMemberAndTermService = async (
      memberId: string,
      termId: string,
) => {
      const existing = await getMemberTermByMemberAndTerm(memberId, termId);
      return existing ?? null;
};

export const getMemberTermsService = async (pagination: Pagination) => {
      const cacheKey = `member-terms:${pagination.page}:${pagination.limit}`;
      const cached = await getCache<{
            memberTerms: MemberTerms[];
            pagination: ReturnType<typeof getPaginationMeta>;
      }>(cacheKey);
      if (cached) return cached;

      const [memberTerms, total] = await Promise.all([
            getMemberTerms(pagination),
            countMemberTerms(),
      ]);
      const res = {
            memberTerms,
            pagination: getPaginationMeta(pagination, total),
      };
      await setCache(cacheKey, res, DEFAULT_CACHE_TTL_SECONDS);
      return res;
};

export const getMemberTermByIdService = async (id: string) => {
      const cacheKey = `member-terms:${id}`;
      const cached = await getCache<MemberTerms>(cacheKey);
      if (cached) return cached;

      const memberTerm = await getMemberTermById(id);
      if (!memberTerm) {
            throw new AppError(404, "Member term not found");
      }
      await setCache(cacheKey, memberTerm, DEFAULT_CACHE_TTL_SECONDS);
      return memberTerm;
};

export const updateMemberTermService = async (
      id: string,
      data: UpdateMemberTermDTO,
) => {
      const existing = await getMemberTermById(id);
      if (!existing) {
            throw new AppError(404, "Member term not found");
      }

      if (data.profileMediaId && !(await getMediaById(data.profileMediaId))) {
            throw new AppError(400, "profileMediaId must reference existing media");
      }

      const updated = await updateMemberTerm(id, {
            ...data,
            updatedAt: new Date(),
      });
      await deleteCache(`member-terms:${id}`);
      await clearCacheByPrefix("member-terms:");
      // Term avatar snapshots reference the member row; drop member caches too.
      await clearCacheByPrefix("team-members:");
      return updated;
};

export const deleteMemberTermService = async (id: string) => {
      const existing = await getMemberTermById(id);
      if (!existing) {
            throw new AppError(404, "Member term not found");
      }
      await deleteCache(`member-terms:${id}`);
      await clearCacheByPrefix("member-terms:");
      // Term avatar snapshots reference the member row; drop member caches too.
      await clearCacheByPrefix("team-members:");
      await deleteMemberTerm(id);
};
