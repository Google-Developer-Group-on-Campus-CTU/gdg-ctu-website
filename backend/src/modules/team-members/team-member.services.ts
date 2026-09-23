import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import { createMediaService } from "../media/media.services.js";
import {
      NewTeamMemberRecord,
      insertTeamMember,
      countTeamMembers,
      deleteTeamMember,
      getTeamMemberById,
      getTeamMemberBySlug,
      getTeamMembers,
      getActiveTeamMembersByTerm,
      getActiveTeamMemberBySlug,
      teamMemberHasEventSpeakerReferences,
      updateTeamMember,
} from "./models/team-member.queries.js";
import { UpdateTeamMemberDTO, TeamMember } from "./team-member.validations.js";
import {
      uploadMedia,
      deleteMediaCloudinaryService,
} from "../../config/cloudinary/cloudinary.services.js";
import { createMediaRecord } from "../../config/cloudinary/utils/cloudinary-media-data-helper.js";
import {
      createMemberTermService,
      getMemberTermByMemberAndTermService,
      updateMemberTermService,
} from "../member_terms/member-terms.services.js";
import { cleanupReplacedMedia } from "../../utils/mediaHelper.js";
import logger from "../../utils/logger.js";
import {
      rollbackCloudinaryUpload,
      CloudinaryUploadResult,
} from "../../config/cloudinary/utils/cloudinary-rollback-helper.js";
import { assertAdminExists } from "../auth/assertAdminExistsHelper.js";
// DTO for the multipart "create with image" endpoint.
interface CreateTeamMemberWithImageDTO {
      memberData: NewTeamMemberRecord;
      file: Buffer;
      uploadedBy: string;
}
// DTO for fetching term data from controller
interface FetchMemberTermDetailsDTO {
      termId: string;
      role: string;
      profileMediaId?: string | null;
}
// DTO for multipart updating member data with image
interface UpdateTeamMemberDataWithImageDTO {
      id: string;
      memberData?: UpdateTeamMemberDTO;
      file?: Buffer;
      uploadedBy: string;
}
// DTO for fetching active team members by term
interface PublicTermFilter {
      termId?: string;
      termName?: string;
      currentOnly?: boolean;
      featuredOnly?: boolean;
}

const DEFAULT_MEMBER_MEDIA_FOLDER = "team-members-media";

// Validate Response
export const toTeamMemberResponse = (teamMember: TeamMember | null) =>
      teamMember;

export const createTeamMemberService = async (
      data: CreateTeamMemberWithImageDTO,
      termData: FetchMemberTermDetailsDTO,
) => {
      if (await getTeamMemberBySlug(data.memberData.slug)) {
            throw new AppError(409, "Team member slug already exists");
      }

      if (!data.uploadedBy) {
            throw new AppError(401, "Admin ID missing: Unauthorized");
      }
      await assertAdminExists(data.uploadedBy);

      let uploadResult: CloudinaryUploadResult | null = null;
      try {
            // Upload the profile image to cloudinary
            uploadResult = await uploadMedia(data.file, {
                  folder: DEFAULT_MEMBER_MEDIA_FOLDER,
                  resourceType: "image",
            });
            // Normalize the data for Database meta data storing
            const mediaData = createMediaRecord(uploadResult, data.uploadedBy);
            const userProfileImage = await createMediaService(mediaData);

            const teamMember = await insertTeamMember(
                  data.memberData,
                  userProfileImage.id,
            );

            await createMemberTermService({
                  ...termData,
                  memberId: teamMember.id,
                  profileMediaId: userProfileImage.id,
            });

            return teamMember;
      } catch (error: any) {
            // Moved the cloduinary rollback to a reusable function
            // found at the config cloudinary folder
            if (uploadResult) {
                  await rollbackCloudinaryUpload(uploadResult);
            }

            // Log the actual root cause before throwing the AppError
            logger.error("Root cause for team member creation failure:", {
                  message: error.message,
                  stack: error.stack,
            });

            throw new AppError(
                  400,
                  `Failed to create team member: ${error.message}`,
            );
      }
};

export const getTeamMembersService = async (pagination: Pagination) => {
      const [teamMembers, total] = await Promise.all([
            getTeamMembers(pagination),
            countTeamMembers(),
      ]);

      return {
            teamMembers,
            pagination: getPaginationMeta(pagination, total),
      };
};

export const getTeamMemberByIdService = async (id: string) => {
      const teamMember = await getTeamMemberById(id);
      if (!teamMember) {
            throw new AppError(404, "Team member not found");
      }

      return toTeamMemberResponse(teamMember);
};

export const getTeamMemberBySlugService = async (slug: string) => {
      const teamMember = await getTeamMemberBySlug(slug);
      if (!teamMember) {
            throw new AppError(404, "Team member not found");
      }

      return toTeamMemberResponse(teamMember);
};

export const getActiveTeamMemberBySlugService = async (slug: string) => {
      const teamMember = await getActiveTeamMemberBySlug(slug);
      if (!teamMember) {
            throw new AppError(404, "Team member not found");
      }

      const res = toTeamMemberResponse(teamMember);
      return res;
};

export const getActiveTeamMembersByTermService = async (
      data: PublicTermFilter,
) => {
      const res = await getActiveTeamMembersByTerm(data);
      if (!res) {
            throw new AppError(404, "Team members not found");
      }

      return res;
};

export const updateTeamMemberService = async (
      data: UpdateTeamMemberDataWithImageDTO,
      termData?: FetchMemberTermDetailsDTO,
) => {
      const teamMember = await getTeamMemberById(data.id);
      if (!teamMember) {
            throw new AppError(404, "Team member not found");
      }

      if (!data.uploadedBy) {
            throw new AppError(401, "Admin ID missing: Unauthorized");
      }
      await assertAdminExists(data.uploadedBy);

      if (data.memberData?.slug && data.memberData.slug !== teamMember.slug) {
            const existingTeamMember = await getTeamMemberBySlug(
                  data.memberData.slug,
            );

            if (existingTeamMember) {
                  throw new AppError(409, "Team member slug already exists");
            }
      }

      // Keep track of the previous media so we can clean up if replaced.
      const oldMediaId = teamMember.profileMediaId ?? undefined;

      // Track the Cloudinary upload result so we can roll back if DB fails
      let uploadResult: CloudinaryUploadResult | null = null;
      try {
            let newMediaId = oldMediaId;

            // If a new file is supplied, upload it and create a new media record.
            if (data.file && data.uploadedBy) {
                  uploadResult = await uploadMedia(data.file, {
                        folder: DEFAULT_MEMBER_MEDIA_FOLDER,
                        resourceType: "image",
                  });
                  const mediaData = createMediaRecord(
                        uploadResult,
                        data.uploadedBy,
                  );
                  const newMedia = await createMediaService(mediaData);
                  newMediaId = newMedia.id;
            }

            // Prepare member updates – may be undefined (image‑only or term‑only updates)
            const memberUpdates: UpdateTeamMemberDTO =
                  data.memberData ?? ({} as UpdateTeamMemberDTO);
            // Update the team‑member, ensuring we include the (possibly new) profileMediaId.
            const updatedTeamMember = await updateTeamMember(data.id, {
                  ...memberUpdates,
                  profileMediaId: newMediaId,
                  updatedAt: new Date(),
            });

            if (termData?.termId && termData?.role) {
                  const termProfileMediaId = data.file ? newMediaId : undefined;

                  // Check if the member already has an assignment for this term
                  const existingMemberTerm =
                        await getMemberTermByMemberAndTermService(
                              teamMember.id,
                              termData.termId,
                        );

                  if (existingMemberTerm) {
                        // Preserve the assignment row; update its term-specific
                        // avatar only when this request uploaded a new photo.
                        await updateMemberTermService(existingMemberTerm.id, {
                              role: termData.role,
                              ...(termProfileMediaId
                                    ? { profileMediaId: termProfileMediaId }
                                    : {}),
                        });
                  } else {
                        // New continuing-officer assignment gets an avatar snapshot
                        // so future uploads do not rewrite this term's roster.
                        await createMemberTermService({
                              ...termData,
                              memberId: teamMember.id,
                              profileMediaId: termProfileMediaId ?? newMediaId,
                        });
                  }
            }

            await cleanupReplacedMedia(oldMediaId, newMediaId);

            return toTeamMemberResponse(updatedTeamMember);
      } catch (error: any) {
            // Moved the cloduinary rollback to a reusable function
            // found at the config cloudinary folder
            if (uploadResult) {
                  await rollbackCloudinaryUpload(uploadResult);
            }

            logger.error("Failed to update team member data", {
                  message: error.message,
                  stack: error.stack,
            });

            if (error instanceof AppError) {
                  throw error;
            }

            throw new AppError(400, "Failed to update team member data");
      }
};

export const deleteTeamMemberService = async (id: string) => {
      const teamMember = await getTeamMemberById(id);
      if (!teamMember) {
            throw new AppError(404, "Team member not found");
      }

      if (await teamMemberHasEventSpeakerReferences(id)) {
            throw new AppError(
                  409,
                  "Team member cannot be deleted while assigned to events",
            );
      }

      deleteTeamMember(id);
      await cleanupReplacedMedia(teamMember.profileMediaId, null);
};
