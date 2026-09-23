import type { Admin } from "../admins/admin.validations.js";

/**
 * Accepts both user-table rows (Admin) and Better Auth session users — the
 * fields used here overlap structurally, so a narrow shared shape is enough.
 * `role`/`banned` allow null because the admin plugin types them optional
 * while the session user may carry null from storage.
 */
type AdminLike = Pick<Admin, "id" | "email"> & {
      name?: string | null;
      role?: string | null;
      banned?: boolean | null;
      createdAt?: Date | null;
      updatedAt?: Date | null;
};

/** Public shape of the current user — kept synchronous (no Promise in JSON). */
export function serializeAdmin(admin: AdminLike) {
      return {
            id: admin.id,
            email: admin.email,
            name: admin.name ?? null,
            role: admin.role ?? "user",
            // Fold: isActive keeps its historical meaning — inverse of banned.
            isActive: !admin.banned,
            createdAt: admin.createdAt ?? null,
            updatedAt: admin.updatedAt ?? null,
      };
}
