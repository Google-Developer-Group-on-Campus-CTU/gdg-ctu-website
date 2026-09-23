import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { AppError } from "../../utils/http.js";
import { getPaginationMeta, Pagination } from "../../utils/pagination.js";
import {
      adminHasReferences,
      countAdmins,
      deleteAdmin,
      getAdminByEmail,
      getAdminById,
      getAdmins,
      insertAdmin,
      insertCredentialAccount,
      updateAdmin,
      type NewAdminRecord,
} from "./models/admin.queries.js";
import {
      AdminRecord,
      CreateAdminDTO,
      UpdateAdminDTO,
} from "./admin.validations.js";
import {
      getCache,
      setCache,
      deleteCache,
      clearCacheByPrefix,
} from "../../config/redis/redis.services.js";

// Constant value for cache timeout
const DEFAULT_CACHE_TIME_TO_LIVE = 60000;

export const toAdminResponse = (admin: AdminRecord) => {
      // Public API shape. Passwords never reach this point — they live in
      // `account.password`; `isActive` keeps its historical meaning as the
      // inverse of the admin plugin's `banned` flag.
      return {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            // role is nullable in the Better Auth schema — surface the same
            // default the admin plugin applies in code.
            role: admin.role ?? "user",
            isActive: !admin.banned,
            createdAt: admin.createdAt,
            updatedAt: admin.updatedAt,
      } as const;
};

export const createAdminService = async (data: CreateAdminDTO) => {
      const existingAdmin = await getAdminByEmail(data.email);

      if (existingAdmin) {
            throw new AppError(409, "Admin email already exists");
      }

      const record = await insertAdmin({
            // Better Auth generates IDs for its own sign-up flows; rows created
            // through this admin API need one up front (user.id has no default).
            id: randomUUID(),
            email: data.email,
            name: data.name ?? data.email.split("@")[0],
            role: data.role,
            // Admins created with a password can sign in immediately; without
            // one, the account verifies on first Google sign-in with this email.
            emailVerified: Boolean(data.password),
      });

      if (data.password) {
            await insertCredentialAccount({
                  id: randomUUID(),
                  userId: record.id,
                  passwordHash: await hashPassword(data.password),
            });
      }

      await clearCacheByPrefix("admins:");
      return toAdminResponse(record);
};

export const getAdminsService = async (pagination: Pagination) => {
      const cacheKey = `admins:${pagination.page}:${pagination.limit}`;

      // Check Cache
      const cached = await getCache<{
            admins: ReturnType<typeof toAdminResponse>[];
            pagination: ReturnType<typeof getPaginationMeta>;
      }>(cacheKey);

      if (cached) return cached;

      // Cache Miss
      const [admins, total] = await Promise.all([
            getAdmins(pagination),
            countAdmins(),
      ]);

      const res = {
            admins: admins.map(toAdminResponse),
            pagination: getPaginationMeta(pagination, total),
      };

      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);
      return res;
};

export const getAdminByIdService = async (id: string) => {
      const cacheKey = `admins:${id}`;
      const cachedAdmin =
            await getCache<ReturnType<typeof toAdminResponse>>(cacheKey);
      if (cachedAdmin) return cachedAdmin;

      const admin = await getAdminById(id);
      if (!admin) {
            throw new AppError(404, "Admin not found");
      }

      const res = toAdminResponse(admin);
      await setCache(cacheKey, res, DEFAULT_CACHE_TIME_TO_LIVE);

      return res;
};

export const updateAdminService = async (id: string, data: UpdateAdminDTO) => {
      const admin = await getAdminById(id);

      if (!admin) {
            throw new AppError(404, "Admin not found");
      }

      const { isActive, email, ...rest } = data;

      if (email && email !== admin.email) {
            const existingAdmin = await getAdminByEmail(email);

            if (existingAdmin) {
                  throw new AppError(409, "Admin email already exists");
            }
      }

      const patch: Partial<NewAdminRecord> = {
            ...rest,
            updatedAt: new Date(),
      };
      if (email) patch.email = email;

      // isActive folds onto the admin plugin's `banned` flag.
      if (isActive === false) {
            patch.banned = true;
            patch.banReason = admin.banReason ?? "Deactivated by admin";
      } else if (isActive === true) {
            patch.banned = false;
            patch.banReason = null;
            patch.banExpires = null;
      }

      const updatedAdmin = await updateAdmin(id, patch);

      await deleteCache(`admins:${id}`);
      await clearCacheByPrefix("admins:");

      return toAdminResponse(updatedAdmin);
};

export const deleteAdminService = async (id: string) => {
      const admin = await getAdminById(id);

      if (!admin) {
            throw new AppError(404, "Admin not found");
      }

      if (await adminHasReferences(id)) {
            throw new AppError(
                  409,
                  "Admin cannot be deleted while referenced by events, media, or site content",
            );
      }

      await deleteCache(`admins:${id}`);
      await clearCacheByPrefix("admins:");
      await deleteAdmin(id);
};
