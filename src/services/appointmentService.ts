import { eq, and, or, lt, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { appointments, services, users } from '../db/schema.js';

export const appointmentService = {
  async createAppointment(
    clientId: number,
    data: { masterId: number; serviceId: number; dateStr: string; timeStr: string; comment?: string }
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

      const endTime = new Date(startTime.getTime() + service.duration * 60 * 1000);

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
          status: 'confirmed', // Defaulting to confirmed for simplicity as per plan
          clientComment: data.comment
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
  }
};

