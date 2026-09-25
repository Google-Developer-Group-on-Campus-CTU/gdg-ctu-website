import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { contactMessages } from "./models/contact-message.js";

export const ContactMessageStatusEnum = z.enum([
      "new",
      "read",
      "replied",
      "archived",
]);

export const ContactMessageSchema = createSelectSchema(contactMessages);

export const CreateContactMessageSchema = createInsertSchema(contactMessages)
      .omit({ id: true, createdAt: true, updatedAt: true })
      .extend({
            name: z.string().trim().min(1, { message: "Name is required." }),
            email: z
                  .string()
                  .trim()
                  .min(1, { message: "Valid email is required." })
                  .pipe(z.email({ message: "Valid email is required." })),
            subject: z
                  .string()
                  .trim()
                  .max(255, { message: "Subject must be at most 255 characters." })
                  .optional(),
            message: z
                  .string()
                  .trim()
                  .min(1, { message: "Message is required." })
                  .max(2000, {
                        message: "Message must be at most 2000 characters.",
                  }),
            status: ContactMessageStatusEnum.optional(),
      });

export const SubmitContactMessageSchema = CreateContactMessageSchema.omit({
      status: true,
});

export const UpdateContactMessageSchema =
      CreateContactMessageSchema.partial().refine(
            (data) => Object.keys(data).length > 0,
            "At least one field is required",
      );

export type ContactMessage = z.infer<typeof ContactMessageSchema>;
export type CreateContactMessageDTO = z.infer<
      typeof CreateContactMessageSchema
>;
export type SubmitContactMessageDTO = z.infer<
      typeof SubmitContactMessageSchema
>;
export type UpdateContactMessageDTO = z.infer<
      typeof UpdateContactMessageSchema
>;
