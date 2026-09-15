import { AppError } from "../../utils/http";
import { getPaginationMeta, Pagination } from "../../utils/pagination";
import { createMediaService } from "../media/media.services";
import {
      NewTeamMemberRecord,
      insertTeamMember,
      countTeamMembers,
      deleteTeamMember,
      getTeamMemberById,
      getTeamMemberBySlug,
      getTeamMembers,
      teamMemberHasEventSpeakerReferences,
      updateTeamMember,
} from "./models/team-member.queries";
import { UpdateTeamMemberDTO, TeamMember } from "./team-member.validations";
import {
      getCache,
      setCache,
      clearCacheByPrefix,
} from "../../config/redis/redis.services";
import {
      uploadMedia,
      deleteMediaCloudinaryService,
} from "../../config/cloudinary/cloudinary.services";
import { createMediaRecord } from "../../config/cloudinary/utils/cloudinary-media-data-helper";
import { createMemberTermService } from "../member_terms/member-terms.services";
import { cleanupReplacedMedia } from "../../utils/mediaHelper";
import logger from "../../utils/logger";
import { getTermByIdService } from "../terms/terms.services";

const isCloudinaryDisabledError = (error: any): boolean =>
      (error instanceof AppError && error.statusCode === 503) ||
      (typeof error?.message === "string" &&
            error.message.includes("not configured"));
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
}
// DTO for multipart updating member data with image
interface UpdateTeamMemberDataWithImageDTO {
      id: string;
      memberData: UpdateTeamMemberDTO;
      file: Buffer;
      uploadedBy: string;
}

// Constant value for cache timeout
const DEFAULT_CACHE_TIME_TO_LIVE = 60000;

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

      if (!(await getTermByIdService(termData.termId))) {
            throw new AppError(409, "Term not found");
      }

      // Upload the profile image to cloudinary
      const uploadResult = await uploadMedia(data.file, {
            folder: "media",
            resourceType: "image",
      });
      // Normalize the data for Database meta data storing
      const mediaData = createMediaRecord(uploadResult, data.uploadedBy);
      const userProfileImage = await createMediaService(mediaData);

      try {
            const teamMember = await insertTeamMember(
                  data.memberData,
                  userProfileImage.id,
            );

            await createMemberTermService({
                  ...termData,
                  memberId: teamMember.id,
            });

            await clearCacheByPrefix("team-members:");
            return teamMember;
      } catch (error: any) {
            // Database creation failed, delete the uploaded photo immediately.
            try {
                  await deleteMediaCloudinaryService(
                        uploadResult.public_id,
                        (uploadResult.resource_type === "auto"
                              ? "image"
                              : uploadResult.resource_type) as
                              "image" | "video" | "raw",
                  );
            } catch (cleanupError: any) {
                  if (!isCloudinaryDisabledError(cleanupError)) {
                        throw cleanupError;
                  }
                  logger.warn(
                        "Cloudinary disabled - skipping Cloudinary rollback delete",
                  );
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
      const cacheKey = `team-members:${pagination.page}:${pagination.limit}`;

      // Check Cache
      const cachedMember = await getCache<{
            teamMembers: TeamMember[];
            pagination: ReturnType<typeof getPaginationMeta>;
      }>(cacheKey);

      if (cachedMember) return cachedMember;

      // Cache Miss
      const [teamMembers, total] = await Promise.all([
            getTeamMembers(pagination),
            countTeamMembers(),
      ]);

      const res = {
            teamMembers,
            pagination: getPaginationMeta(pagination, total),
      };

      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);
      return res;
};

export const getTeamMemberByIdService = async (id: string) => {
      const cacheKey = `team-members:${id}`;
      const cached = await getCache<TeamMember>(cacheKey);
      if (cached) return cached;

      const teamMember = await getTeamMemberById(id);
      if (!teamMember) {
            throw new AppError(404, "Team member not found");
      }

      const res = toTeamMemberResponse(teamMember);
      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);

      return res;
};

export const getTeamMemberBySlugService = async (slug: string) => {
      const cacheKey = `team-members:${slug}`;
      const cached = await getCache<TeamMember>(cacheKey);
      if (cached) return cached;

      const teamMember = await getTeamMemberBySlug(slug);
      if (!teamMember) {
            throw new AppError(404, "Team member not found");
      }

      const res = toTeamMemberResponse(teamMember);
      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);

      return res;
};

export const updateTeamMemberService = async (
      data: UpdateTeamMemberDataWithImageDTO,
) => {
      const teamMember = await getTeamMemberById(data.id);
      if (!teamMember) {
            throw new AppError(404, "Team member not found");
      }

      if (data.memberData.slug && data.memberData.slug !== teamMember.slug) {
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
      let uploadResult: any = null;

      try {
            let newMediaId = oldMediaId;

            // If a new file is supplied, upload it and create a new media record.
            if (data.file && data.uploadedBy) {
                  uploadResult = await uploadMedia(data.file, {
                        folder: "media",
                        resourceType: "image",
                  });
                  const mediaData = createMediaRecord(
                        uploadResult,
                        data.uploadedBy,
                  );
                  const newMedia = await createMediaService(mediaData);
                  newMediaId = newMedia.id;
            }

            // Update the team‑member, ensuring we include the (possibly new) profileMediaId.
            const updatedTeamMember = await updateTeamMember(data.id, {
                  ...data.memberData,
                  profileMediaId: newMediaId,
                  updatedAt: new Date(),
            });

            await Promise.all([
                  cleanupReplacedMedia(oldMediaId, newMediaId),
                  clearCacheByPrefix("team-members:"),
            ]);

            return toTeamMemberResponse(updatedTeamMember);
      } catch (error: any) {
            // Guard clause: Rollback Cloudinary upload if DB/subsequent steps fail
            if (uploadResult) {
                  try {
                        await deleteMediaCloudinaryService(
                              uploadResult.public_id,
                              (uploadResult.resource_type === "auto"
                                    ? "image"
                                    : uploadResult.resource_type) as
                                    "image" | "video" | "raw",
                        );
                  } catch (cleanupError: any) {
                        if (!isCloudinaryDisabledError(cleanupError)) {
                              logger.error(
                                    "Failed to delete Cloudinary media during rollback",
                                    {
                                          message: cleanupError.message,
                                    },
                              );
                        } else {
                              logger.warn(
                                    "Cloudinary disabled - skipping Cloudinary rollback delete",
                              );
                        }
                  }
            }

            logger.error("Failed to update team member data", {
                  message: error.message,
                  stack: error.stack,
            });
            throw new AppError(
                  400, // Changed from 401 to 400 since this isn't an auth error
                  "An Error has Occured: Failed to update team member data",
            );
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
      await Promise.all([
            cleanupReplacedMedia(teamMember.profileMediaId, null),
            clearCacheByPrefix("team-members:"),
      ]);
};
