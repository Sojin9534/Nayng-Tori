import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cats = sqliteTable("cats", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  birthDate: text("birth_date").notNull(),
  breed: text("breed").notNull().default("브리티시 숏헤어"),
  bio: text("bio").notNull().default(""),
  profileImageKey: text("profile_image_key"),
  shareSlug: text("share_slug").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const lifeLogs = sqliteTable("life_logs", {
  id: text("id").primaryKey(),
  catId: text("cat_id").notNull(),
  authorId: text("author_id").notNull(),
  type: text("type").notNull(),
  value: real("value"),
  unit: text("unit"),
  status: text("status"),
  memo: text("memo").notNull().default(""),
  occurredAt: text("occurred_at").notNull(),
}, (table) => [index("idx_life_logs_cat_time").on(table.catId, table.occurredAt)]);

export const albumEntries = sqliteTable("album_entries", {
  id: text("id").primaryKey(),
  catId: text("cat_id").notNull(),
  imageKey: text("image_key"),
  fallbackUrl: text("fallback_url"),
  caption: text("caption").notNull(),
  takenAt: text("taken_at").notNull(),
  milestone: text("milestone"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_album_entries_cat_public_date").on(table.catId, table.isPublic, table.takenAt)]);
