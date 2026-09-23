import { z } from "zod";

/**
 * POST /public/admin-invites/redeem body.
 * name 1–100 after trim, email valid + normalized, password min 8.
 */
export const RedeemAdminInviteSchema = z.object({
      token: z
            .string()
            .trim()
            .min(1, { message: "Token is required." }),
      name: z
            .string()
            .trim()
            .min(1, { message: "Name must be a non-empty string." })
            .max(100, { message: "Name must be at most 100 characters." }),
      email: z
            .email({ error: "Please provide a valid email address." })
            .trim()
            .toLowerCase(),
      password: z
            .string()
            .min(8, { message: "Password must be at least 8 characters." }),
});

export type RedeemAdminInviteDTO = z.infer<typeof RedeemAdminInviteSchema>;
