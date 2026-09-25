import { relations } from "drizzle-orm";
import { contactMessages } from "./contact-message.js";

export const contactMessagesRelations = relations(
      contactMessages,
      () => ({}),
);
