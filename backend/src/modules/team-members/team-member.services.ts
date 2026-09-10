import { AppError } from "../../utils/http";
import { getPaginationMeta, Pagination } from "../../utils/pagination";
import {
      createMediaService,
      getMediaByIdService,
      deleteMediaService,
} from "../media/media.services";
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
      deleteCache,
      clearCacheByPrefix,
} from "../../config/redis/redis.services";
import {
      uploadMedia,
      deleteMedia as deleteMediaCloudinaryService,
} from "../../config/cloudinary/cloudinary.services";
import { createMediaRecord } from "../../config/cloudinary/utils/cloudinary-media-data-helper";
// DTO for the multipart "create with image" endpoint.
interface CreateTeamMemberWithImageDTO {
      memberData: NewTeamMemberRecord;
      file: Buffer;
      uploadedBy: string;
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
) => {
      if (await getTeamMemberBySlug(data.memberData.slug)) {
            throw new AppError(409, "Team member slug already exists");
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

            await clearCacheByPrefix("team-members:");
            return teamMember;
      } catch (error) {
            // Database creation failed, delete the uploaded photo immediately
            await deleteMediaCloudinaryService(
                  uploadResult.public_id,
                  (uploadResult.resource_type === "auto"
                        ? "image"
                        : uploadResult.resource_type) as
                        | "image"
                        | "video"
                        | "raw",
            );
            throw new AppError(
                  400,
                  "An Error has Occured: Failed to create team member with its profile imaage",
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

      try {
            let newMediaId = oldMediaId;

            // If a new file is supplied, upload it and create a new media record.
            if (data.file && data.uploadedBy) {
                  const uploadResult = await uploadMedia(data.file, {
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
                  ...data,
                  profileMediaId: newMediaId,
                  updatedAt: new Date(),
            });

            // Delete previous profile image of the user
            if (oldMediaId && oldMediaId !== newMediaId) {
                  // Delete DB record
                  const oldMedia = await getMediaByIdService(oldMediaId);
                  if (oldMedia) {
                        // First remove from Cloudinary
                        await deleteMediaCloudinaryService(
                              oldMedia.publicId,
                              oldMedia.resourceType as any,
                        );
                        // Delete meta data
                        await deleteMediaService(oldMedia.id);
                  }
            }

            await deleteCache(`team-members:${data.id}`);
            await clearCacheByPrefix("team-members:");

            return toTeamMemberResponse(updatedTeamMember);
      } catch (error) {
            throw new AppError(
                  401,
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

      await deleteTeamMember(id);
      await deleteCache(`team-members:${id}`);
      await clearCacheByPrefix("team-members:");

      // Handle Media Cleanup
      if (teamMember.profileMediaId) {
            try {
                  // Retrieve the media details
                  const mediaRecord = await getMediaByIdService(
                        teamMember.profileMediaId,
                  );

                  if (mediaRecord) {
                        // Delete the media meta data from the database
                        await deleteMediaService(teamMember.profileMediaId);
                        // Delete the physical file from Cloudinary
                        await deleteMediaCloudinaryService(
                              mediaRecord.publicId,
                              mediaRecord.resourceType as any,
                        );
                  }
            } catch (error) {
                  throw new AppError(
                        401,
                        "An Error has Occured: Failed to delete team member data",
                  );
            }
      }
};
