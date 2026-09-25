import {
  pgTable, uuid, bigint, text, timestamp, integer,
  boolean, numeric, serial, bigserial, index, uniqueIndex, pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── ENUM'ы ────────────────────────────────────────────────
export const roleEnum = pgEnum('role', [
  'resident', 'uk', 'rso', 'contractor', 'admin',
]);
export const ticketStatusEnum = pgEnum('ticket_status', [
  'new', 'accepted', 'in_progress', 'done', 'rejected', 'escalated',
]);
export const priorityEnum = pgEnum('priority', [
  'low', 'normal', 'high', 'emergency',
]);

// ─── Профили ───────────────────────────────────────────────
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  maxUserId: bigint('max_user_id', { mode: 'number' }).notNull().unique(),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  phone: text('phone'),
  role: roleEnum('role').notNull().default('resident'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Дома ──────────────────────────────────────────────────
export const houses = pgTable('houses', {
  id: uuid('id').primaryKey().defaultRandom(),
  address: text('address').notNull(),
  fiasId: text('fias_id'),
  gisZhkhId: text('gis_zhkh_id'),
  ukId: uuid('uk_id').references(() => profiles.id),
  region: text('region'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Помещения ─────────────────────────────────────────────
export const premises = pgTable('premises', {
  id: uuid('id').primaryKey().defaultRandom(),
  houseId: uuid('house_id').notNull().references(() => houses.id, { onDelete: 'cascade' }),
  number: text('number').notNull(),
  type: text('type').default('apartment'),
  area: numeric('area'),
}, (t) => ({
  uniqHouseNumber: uniqueIndex('premises_house_number_uniq').on(t.houseId, t.number),
}));

// ─── Проживание ────────────────────────────────────────────
export const residencies = pgTable('residencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  premiseId: uuid('premise_id').notNull().references(() => premises.id, { onDelete: 'cascade' }),
  verified: boolean('verified').default(false),
}, (t) => ({
  uniq: uniqueIndex('residencies_uniq').on(t.profileId, t.premiseId),
}));

// ─── Категории ─────────────────────────────────────────────
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  defaultSlaHours: integer('default_sla_hours').default(24),
  responsibleRole: roleEnum('responsible_role'),
});

// ─── Обращения ─────────────────────────────────────────────
export const tickets = pgTable('tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => profiles.id),
  premiseId: uuid('premise_id').references(() => premises.id),
  categoryId: integer('category_id').references(() => categories.id),
  title: text('title').notNull(),
  description: text('description'),
  photos: text('photos').array(),
  status: ticketStatusEnum('status').notNull().default('new'),
  priority: priorityEnum('priority').notNull().default('normal'),
  assigneeId: uuid('assignee_id').references(() => profiles.id),
  slaDeadline: timestamp('sla_deadline', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
}, (t) => ({
  idxStatusCreated: index('tickets_status_created_idx').on(t.status, t.createdAt),
  idxAuthor: index('tickets_author_idx').on(t.authorId),
  idxAssignee: index('tickets_assignee_idx').on(t.assigneeId),
}));

// ─── Сообщения ─────────────────────────────────────────────
export const ticketMessages = pgTable('ticket_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').references(() => profiles.id),
  body: text('body'),
  attachments: text('attachments').array(),
  isSystem: boolean('is_system').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── События ───────────────────────────────────────────────
export const ticketEvents = pgTable('ticket_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  ticketId: uuid('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => profiles.id),
  fromStatus: ticketStatusEnum('from_status'),
  toStatus: ticketStatusEnum('to_status'),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Relations (для query API) ─────────────────────────────
export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  author: one(profiles, { fields: [tickets.authorId], references: [profiles.id] }),
  assignee: one(profiles, { fields: [tickets.assigneeId], references: [profiles.id] }),
  category: one(categories, { fields: [tickets.categoryId], references: [categories.id] }),
  premise: one(premises, { fields: [tickets.premiseId], references: [premises.id] }),
  messages: many(ticketMessages),
  events: many(ticketEvents),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketMessages.ticketId], references: [tickets.id] }),
  author: one(profiles, { fields: [ticketMessages.authorId], references: [profiles.id] }),
}));