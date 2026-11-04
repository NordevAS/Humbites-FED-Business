import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const demoSandboxes = sqliteTable('demo_sandboxes', {
  id: text('id').primaryKey(), revision: integer('revision').notNull().default(0), state: text('state').notNull(),
  expiresAt: integer('expires_at').notNull(), createdAt: integer('created_at').notNull(),
}, table => [index('demo_sandbox_expiry').on(table.expiresAt)]);
export const demoReceipts = sqliteTable('demo_receipts', {
  bookingId: text('booking_id').primaryKey(), sandboxId: text('sandbox_id').notNull().references(()=>demoSandboxes.id,{onDelete:'cascade'}), tokenHash: text('token_hash').notNull(),
}, table => [index('demo_receipt_token').on(table.tokenHash)]);
export { demoMedia } from './media-schema';
