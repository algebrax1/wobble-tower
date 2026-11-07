import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const players = pgTable("players", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  highestLevel: integer("highest_level").notNull().default(0),
  totalStars: integer("total_stars").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
