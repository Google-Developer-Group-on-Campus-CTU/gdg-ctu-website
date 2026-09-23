import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { user } from "../auth/models/auth.js";

// Fold: admin records are Better Auth `user` rows (role/banned replace the
// old admins.id / isActive columns).
export const AdminRecordSchema = createSelectSchema(user);

export const AdminSchema = AdminRecordSchema;

export const CreateAdminSchema = z.object({
      email: z
            .email({ error: "Please provide a valid email address." })
            .trim()
            .toLowerCase(),
      name: z
            .string()
            .trim()
            .min(1, { message: "Name must be a non-empty string." })
            .optional(),
      // Optional: create the email+password login in the same step (scrypt
      // hash in `account`). Without it the user can still sign in via Google
      // using this email.
      password: z
            .string()
            .min(8, { message: "Password must be at least 8 characters." })
            .optional(),
      role: z.enum(["user", "admin"]).default("admin"),
});

export const UpdateAdminSchema = z
      .object({
            email: z
                  .email({ error: "Please provide a valid email address." })
                  .trim()
                  .toLowerCase()
                  .optional(),
            name: z
                  .string()
                  .trim()
                  .min(1, { message: "Name must be a non-empty string." })
                  .optional(),
            role: z.enum(["user", "admin"]).optional(),
            // Legacy toggle — folds onto the admin plugin's `banned` flag
            // (isActive=false ⇒ banned ⇒ requireAuth answers 403).
            isActive: z.boolean().optional(),
      })
      .refine((data) => Object.keys(data).length > 0, "At least one field is required");

export type AdminRecord = z.infer<typeof AdminRecordSchema>;
export type Admin = z.infer<typeof AdminSchema>;
export type CreateAdminDTO = z.infer<typeof CreateAdminSchema>;
export type UpdateAdminDTO = z.infer<typeof UpdateAdminSchema>;
