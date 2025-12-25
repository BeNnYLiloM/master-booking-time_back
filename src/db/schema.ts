import { pgTable, serial, text, integer, jsonb, timestamp, boolean, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- USERS ---
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: text('telegram_id').notNull().unique(),
  role: text('role', { enum: ['master', 'client'] }).default('client').notNull(),
  firstName: text('first_name'),
  username: text('username'),
  // Master profile data stored in JSONB for flexibility as per plan
  masterProfile: jsonb('master_profile').$type<{
    displayName?: string;
    description?: string;
    workingDates: {
      [date: string]: { // "YYYY-MM-DD"
        start: string;  // "HH:MM"
        end: string;    // "HH:MM"
      };
    };
  }>(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  services: many(services),
  masterAppointments: many(appointments, { relationName: 'masterAppointments' }),
  clientAppointments: many(appointments, { relationName: 'clientAppointments' }),
}));

// --- SERVICES ---
export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  masterId: integer('master_id').references(() => users.id).notNull(),
  title: text('title').notNull(),
  price: integer('price').notNull(), // Stored in cents/smallest unit or just raw number
  duration: integer('duration').default(60).notNull(), // minutes
  currency: text('currency').default('RUB').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const servicesRelations = relations(services, ({ one }) => ({
  master: one(users, {
    fields: [services.masterId],
    references: [users.id],
  }),
}));

// --- APPOINTMENTS ---
export const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  masterId: integer('master_id').references(() => users.id).notNull(),
  clientId: integer('client_id').references(() => users.id).notNull(),
  serviceId: integer('service_id').references(() => services.id),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  status: text('status', { enum: ['pending', 'confirmed', 'cancelled', 'awaiting_review', 'completed'] }).default('confirmed').notNull(),
  clientComment: text('client_comment'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  master: one(users, {
    fields: [appointments.masterId],
    references: [users.id],
    relationName: 'masterAppointments',
  }),
  client: one(users, {
    fields: [appointments.clientId],
    references: [users.id],
    relationName: 'clientAppointments',
  }),
  service: one(services, {
    fields: [appointments.serviceId],
    references: [services.id],
  }),
}));

