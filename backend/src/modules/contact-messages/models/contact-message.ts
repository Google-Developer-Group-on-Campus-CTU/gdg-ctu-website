import {
      pgTable,
      text,
      timestamp,
      uuid,
      varchar,
} from "drizzle-orm/pg-core";

export const contactMessages = pgTable("contact_messages", {
      id: uuid("id").defaultRandom().primaryKey(),
      name: varchar("name", { length: 255 }).notNull(),
      email: varchar("email", { length: 255 }).notNull(),
      subject: varchar("subject", { length: 255 }),
      message: text("message").notNull(),
      status: text("status").default("new").notNull(),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
