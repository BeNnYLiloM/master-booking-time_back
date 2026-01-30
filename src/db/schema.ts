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
    avatarUrl?: string;
    phoneNumber?: string;
    workingDates: {
      [date: string]: { // "YYYY-MM-DD"
        start: string;  // "HH:MM"
        end: string;    // "HH:MM"
      };
    };
    location?: {
      type: 'fixed' | 'mobile' | 'both'; // фиксированный адрес / выезд / оба
      address?: {
        text: string;
        coordinates: [number, number]; // [lat, lng]
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
  locationType: text('location_type', { enum: ['at_master', 'at_client', 'both'] }).default('at_master').notNull(),
  imageUrl: text('image_url'),
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
  locationType: text('location_type', { enum: ['at_master', 'at_client'] }),
  address: jsonb('address').$type<{
    text: string;
    coordinates: [number, number]; // [lat, lng]
  }>(),
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

// --- REVIEWS ---
export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  masterId: integer('master_id').references(() => users.id).notNull(),
  clientId: integer('client_id').references(() => users.id).notNull(),
  appointmentId: integer('appointment_id').references(() => appointments.id).notNull(),
  rating: integer('rating').notNull(), // 1-5 звезд
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const reviewsRelations = relations(reviews, ({ one }) => ({
  master: one(users, {
    fields: [reviews.masterId],
    references: [users.id],
  }),
  client: one(users, {
    fields: [reviews.clientId],
    references: [users.id],
  }),
  appointment: one(appointments, {
    fields: [reviews.appointmentId],
    references: [appointments.id],
  }),
}));
