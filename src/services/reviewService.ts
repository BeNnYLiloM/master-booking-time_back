import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { reviews, appointments } from '../db/schema.js';

export const reviewService = {
  // Создать отзыв (только для completed записей)
  async createReview(appointmentId: number, clientId: number, rating: number, comment?: string) {
    // Проверяем что запись существует и завершена
    const appointment = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.id, appointmentId),
        eq(appointments.clientId, clientId),
        eq(appointments.status, 'completed')
      )
    });

    if (!appointment) {
      throw new Error('Appointment not found or not completed');
    }

    // Проверяем что отзыв ещё не оставлен
    const existingReview = await db.query.reviews.findFirst({
      where: eq(reviews.appointmentId, appointmentId)
    });

    if (existingReview) {
      throw new Error('Review already exists for this appointment');
    }

    // Создаём отзыв
    const [review] = await db.insert(reviews)
      .values({
        masterId: appointment.masterId,
        clientId: clientId,
        appointmentId: appointmentId,
        rating: rating,
        comment: comment || null
      })
      .returning();

    return review;
  },

  // Получить отзывы мастера
  async getMasterReviews(masterId: number, limit: number = 50) {
    return db.query.reviews.findMany({
      where: eq(reviews.masterId, masterId),
      orderBy: [desc(reviews.createdAt)],
      limit: limit,
      with: {
        client: {
          columns: {
            id: true,
            firstName: true,
            username: true
          }
        }
      }
    });
  },

  // Получить средний рейтинг мастера
  async getMasterAverageRating(masterId: number) {
    const masterReviews = await db.query.reviews.findMany({
      where: eq(reviews.masterId, masterId),
      columns: {
        rating: true
      }
    });

    if (masterReviews.length === 0) {
      return { average: 0, count: 0 };
    }

    const sum = masterReviews.reduce((acc, r) => acc + r.rating, 0);
    const average = sum / masterReviews.length;

    return {
      average: Math.round(average * 10) / 10, // Округляем до 1 знака
      count: masterReviews.length
    };
  },

  // Проверить можно ли оставить отзыв
  async canLeaveReview(appointmentId: number, clientId: number) {
    const appointment = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.id, appointmentId),
        eq(appointments.clientId, clientId),
        eq(appointments.status, 'completed')
      )
    });

    if (!appointment) {
      return false;
    }

    const existingReview = await db.query.reviews.findFirst({
      where: eq(reviews.appointmentId, appointmentId)
    });

    return !existingReview;
  }
};
