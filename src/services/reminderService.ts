import cron from 'node-cron';
import { db } from '../db/index.js';
import { appointments, users } from '../db/schema.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { notificationService } from './notificationService.js';

export const reminderService = {
  // Запуск планировщика напоминаний
  startReminderScheduler() {
    // Каждые 10 минут проверяем записи, которым нужно отправить напоминание
    cron.schedule('*/10 * * * *', async () => {
      console.log('🔔 Проверка напоминаний...');
      
      try {
        await this.send24hReminders();
        await this.send1hReminders();
      } catch (error) {
        console.error('Ошибка при отправке напоминаний:', error);
      }
    });

    console.log('✅ Планировщик напоминаний запущен (каждые 10 минут)');
  },

  // Отправка напоминаний за 24 часа
  async send24hReminders() {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in24h10min = new Date(now.getTime() + 24 * 60 * 60 * 1000 + 10 * 60 * 1000);

    // Находим записи, которые будут через 24 часа (±10 минут)
    const upcomingAppointments = await db.query.appointments.findMany({
      where: and(
        gte(appointments.startTime, in24h),
        lte(appointments.startTime, in24h10min),
        eq(appointments.status, 'confirmed')
      ),
      with: {
        client: true,
        master: true,
        service: true
      }
    });

    console.log(`📨 Найдено ${upcomingAppointments.length} записей для напоминания за 24ч`);

    for (const appt of upcomingAppointments) {
      if (!appt.client || !appt.master || !appt.service) continue;

      const masterProfile = appt.master.masterProfile as { displayName?: string; description?: string } | null;
      const masterName = masterProfile?.displayName || appt.master.firstName || 'Мастер';
      const masterDescription = masterProfile?.description || null;
      const time = new Date(appt.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      await notificationService.sendReminder24h(
        appt.client.telegramId,
        masterName,
        masterDescription,
        appt.service.title,
        new Date(appt.startTime),
        time
      );
    }
  },

  // Отправка напоминаний за 1 час
  async send1hReminders() {
    const now = new Date();
    const in1h = new Date(now.getTime() + 60 * 60 * 1000);
    const in1h10min = new Date(now.getTime() + 60 * 60 * 1000 + 10 * 60 * 1000);

    // Находим записи, которые будут через 1 час (±10 минут)
    const upcomingAppointments = await db.query.appointments.findMany({
      where: and(
        gte(appointments.startTime, in1h),
        lte(appointments.startTime, in1h10min),
        eq(appointments.status, 'confirmed')
      ),
      with: {
        client: true,
        master: true,
        service: true
      }
    });

    console.log(`📨 Найдено ${upcomingAppointments.length} записей для напоминания за 1ч`);

    for (const appt of upcomingAppointments) {
      if (!appt.client || !appt.master || !appt.service) continue;

      const masterProfile = appt.master.masterProfile as { displayName?: string; description?: string } | null;
      const masterName = masterProfile?.displayName || appt.master.firstName || 'Мастер';
      const masterDescription = masterProfile?.description || null;
      const time = new Date(appt.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      await notificationService.sendReminder1h(
        appt.client.telegramId,
        masterName,
        masterDescription,
        appt.service.title,
        new Date(appt.startTime),
        time
      );
    }
  }
};
