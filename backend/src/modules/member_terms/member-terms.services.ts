import { AppError } from "../../utils/http";
import { getPaginationMeta, Pagination } from "../../utils/pagination";
import {
      createMemberTerm,
      getMemberTerms,
      getMemberTermByMemberAndTerm,
      countMemberTerms,
      getMemberTermById,
      updateMemberTerm,
      deleteMemberTerm,
} from "./models/member-terms.queries";
import {
      CreateMemberTermsDTO,
      UpdateMemberTermDTO,
      MemberTerms,
} from "./member-terms.validations";
import {
      getCache,
      setCache,
      deleteCache,
      clearCacheByPrefix,
} from "../../config/redis/redis.services";
import { getTeamMemberById } from "../team-members/models/team-member.queries";
import { getTermById } from "../terms/models/terms.queries";

// Cache TTL in milliseconds (e.g., 60 seconds)
const DEFAULT_CACHE_TIME_TO_LIVE = 60000;

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

      // Invalidate related caches before persisting
      await clearCacheByPrefix("member-terms:");

      // Insert the record
      return createMemberTerm(data);
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
      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);
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
      await setCache(cacheKey, memberTerm, DEFAULT_CACHE_TIME_TO_LIVE);
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
      const updated = await updateMemberTerm(id, {
            ...data,
            updatedAt: new Date(),
      });
      await deleteCache(`member-terms:${id}`);
      await clearCacheByPrefix("member-terms:");
      return updated;
};

export const deleteMemberTermService = async (id: string) => {
      const existing = await getMemberTermById(id);
      if (!existing) {
            throw new AppError(404, "Member term not found");
      }
      await deleteCache(`member-terms:${id}`);
      await clearCacheByPrefix("member-terms:");
      await deleteMemberTerm(id);
};
