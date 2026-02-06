import { eq, and, or, lt, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { appointments, services, users } from '../db/schema.js';

export const appointmentService = {
  async createAppointment(
    clientId: number,
    data: { 
      masterId: number; 
      serviceId: number; 
      dateStr: string; 
      timeStr: string; 
      comment?: string;
      locationType?: 'at_master' | 'at_client';
      address?: { text: string; coordinates: [number, number] };
    }
  ) {
    return await db.transaction(async (tx) => {
      // 1. Fetch Service and Master
      const service = await tx.query.services.findFirst({
        where: eq(services.id, data.serviceId),
      });

      if (!service) throw new Error('Service not found');
      if (service.masterId !== data.masterId) throw new Error('Service does not belong to master');

      // 2. Calculate Start and End Time
      // timeStr is "HH:MM"
      const [hours, minutes] = data.timeStr.split(':').map(Number);
      const startTime = new Date(data.dateStr);
      startTime.setHours(hours, minutes, 0, 0);

      // Получаем профиль мастера для breakDuration
      const master = await tx.query.users.findFirst({
        where: eq(users.id, data.masterId),
      });

      const breakDuration = master?.masterProfile?.breakDuration ?? 15; // По умолчанию 15 минут
      const endTime = new Date(startTime.getTime() + (service.duration + breakDuration) * 60 * 1000);

      // 3. Check for Overlaps (Race condition check)
      // We check if any "confirmed" or "pending" appointment overlaps
      const overlaps = await tx.query.appointments.findFirst({
        where: and(
          eq(appointments.masterId, data.masterId),
          or(
            eq(appointments.status, 'confirmed'),
            eq(appointments.status, 'pending')
          ),
          // Overlap: (StartA < EndB) and (EndA > StartB)
          lt(appointments.startTime, endTime),
          gte(appointments.endTime, startTime)
        ),
      });

      if (overlaps) {
        throw new Error('Slot already taken');
      }

      // 4. Create Appointment
      const [newAppointment] = await tx.insert(appointments)
        .values({
          masterId: data.masterId,
          clientId: clientId,
          serviceId: data.serviceId,
          startTime: startTime,
          endTime: endTime,
          status: 'pending', // Ожидает подтверждения мастером
          clientComment: data.comment,
          locationType: data.locationType,
          address: data.address
        })
        .returning();

      return newAppointment;
    });
  },

  async getAppointments(userId: number, role: 'master' | 'client') {
    const field = role === 'master' ? appointments.masterId : appointments.clientId;
    return db.query.appointments.findMany({
      where: eq(field, userId),
      with: {
        service: true,
        master: role === 'client' ? true : undefined,
        client: role === 'master' ? true : undefined,
        review: true, // Добавляем информацию об отзыве
      },
      orderBy: (appointments, { desc }) => [desc(appointments.startTime)],
    });
  },

  async cancelAppointment(appointmentId: number, userId: number, role: 'master' | 'client') {
    // Проверяем что запись существует и принадлежит пользователю
    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
    });

    if (!appointment) {
      throw new Error('Запись не найдена');
    }

    // Клиент может отменить только свою запись
    if (role === 'client' && appointment.clientId !== userId) {
      throw new Error('Нет доступа к этой записи');
    }

    // Мастер может отменить записи к себе
    if (role === 'master' && appointment.masterId !== userId) {
      throw new Error('Нет доступа к этой записи');
    }

    // Нельзя отменить уже отменённую запись
    if (appointment.status === 'cancelled') {
      throw new Error('Запись уже отменена');
    }

    // Обновляем статус
    const [updated] = await db.update(appointments)
      .set({ status: 'cancelled' })
      .where(eq(appointments.id, appointmentId))
      .returning();

    return updated;
  },

  async confirmAppointment(appointmentId: number, masterId: number) {
    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
    });

    if (!appointment) {
      throw new Error('Запись не найдена');
    }

    if (appointment.masterId !== masterId) {
      throw new Error('Нет доступа к этой записи');
    }

    if (appointment.status !== 'pending') {
      throw new Error('Запись уже обработана');
    }

    const [updated] = await db.update(appointments)
      .set({ status: 'confirmed' })
      .where(eq(appointments.id, appointmentId))
      .returning();

    return updated;
  },

  async rejectAppointment(appointmentId: number, masterId: number) {
    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
    });

    if (!appointment) {
      throw new Error('Запись не найдена');
    }

    if (appointment.masterId !== masterId) {
      throw new Error('Нет доступа к этой записи');
    }

    if (appointment.status !== 'pending') {
      throw new Error('Запись уже обработана');
    }

    const [updated] = await db.update(appointments)
      .set({ status: 'cancelled' })
      .where(eq(appointments.id, appointmentId))
      .returning();

    return updated;
  },

  async getAppointmentById(appointmentId: number) {
    return db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
      with: {
        service: true,
        master: true,
        client: true,
      },
    });
  },

  // Мастер отмечает что услуга оказана (ожидает подтверждения клиента)
  async markAsAwaitingReview(appointmentId: number, masterId: number) {
    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
    });

    if (!appointment) {
      throw new Error('Запись не найдена');
    }

    if (appointment.masterId !== masterId) {
      throw new Error('Нет доступа к этой записи');
    }

    if (appointment.status !== 'confirmed') {
      throw new Error('Можно завершить только подтверждённую запись');
    }

    const [updated] = await db.update(appointments)
      .set({ status: 'awaiting_review' })
      .where(eq(appointments.id, appointmentId))
      .returning();

    return updated;
  },

  // Клиент подтверждает что услуга оказана
  async confirmCompletion(appointmentId: number, clientId: number) {
    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
    });

    if (!appointment) {
      throw new Error('Запись не найдена');
    }

    if (appointment.clientId !== clientId) {
      throw new Error('Нет доступа к этой записи');
    }

    if (appointment.status !== 'awaiting_review') {
      throw new Error('Запись не ожидает подтверждения');
    }

    const [updated] = await db.update(appointments)
      .set({ status: 'completed' })
      .where(eq(appointments.id, appointmentId))
      .returning();

    return updated;
  },

  // Клиент оспаривает завершение (возвращает в confirmed)
  async disputeCompletion(appointmentId: number, clientId: number) {
    const appointment = await db.query.appointments.findFirst({
      where: eq(appointments.id, appointmentId),
    });

    if (!appointment) {
      throw new Error('Запись не найдена');
    }

    if (appointment.clientId !== clientId) {
      throw new Error('Нет доступа к этой записи');
    }

    if (appointment.status !== 'awaiting_review') {
      throw new Error('Запись не ожидает подтверждения');
    }

    const [updated] = await db.update(appointments)
      .set({ status: 'confirmed' })
      .where(eq(appointments.id, appointmentId))
      .returning();

    return updated;
  }
};

