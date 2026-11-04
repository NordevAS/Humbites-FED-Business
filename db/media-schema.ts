import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// No FK cascade: expired sandbox metadata must remain discoverable until R2 cleanup.
export const demoMedia = sqliteTable('demo_media', {
  id: text('id').primaryKey(),
  sandboxId: text('sandbox_id').notNull(),
  truckId: text('truck_id').notNull(),
  itemId: text('item_id'),
  stagingKey: text('staging_key').notNull(),
  publishedKey: text('published_key').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  status: text('status').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at').notNull(),
  retainUntil: integer('retain_until').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  width: integer('width'),
  height: integer('height'),
}, table => [
  index('demo_media_sandbox_idx').on(table.sandboxId, table.truckId),
  index('demo_media_expiry_idx').on(table.expiresAt),
]);
