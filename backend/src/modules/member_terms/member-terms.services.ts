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
} from "./member-terms.validations.js";
import { getTeamMemberById } from "../team-members/models/team-member.queries.js";
import { getTermById } from "../terms/models/terms.queries.js";
import { getMediaById } from "../media/models/media.queries.js";

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
      const [memberTerms, total] = await Promise.all([
            getMemberTerms(pagination),
            countMemberTerms(),
      ]);
      return {
            memberTerms,
            pagination: getPaginationMeta(pagination, total),
      };
};

export const getMemberTermByIdService = async (id: string) => {
      const memberTerm = await getMemberTermById(id);
      if (!memberTerm) {
            throw new AppError(404, "Member term not found");
      }
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
      return updated;
};

export const deleteMemberTermService = async (id: string) => {
      const existing = await getMemberTermById(id);
      if (!existing) {
            throw new AppError(404, "Member term not found");
      }
      await deleteMemberTerm(id);
};
