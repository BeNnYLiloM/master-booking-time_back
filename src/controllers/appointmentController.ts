import { Request, Response } from 'express';
import { appointmentService } from '../services/appointmentService.js';
import { notificationService } from '../services/notificationService.js';
import { authService } from '../services/authService.js'; // Need to fetch user details
import { db } from '../db/index.js'; // Direct DB access or service? Better service but for quick fix...
import { users, services } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const bookingSchema = z.object({
  masterId: z.number(),
  serviceId: z.number(),
  dateStr: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeStr: z.string().regex(/^\d{2}:\d{2}$/),
  comment: z.string().optional()
});

export const appointmentController = {
  async create(req: Request, res: Response) {
    try {
      console.log('📝 Booking request:', req.body);
      console.log('👤 User:', req.user?.id, req.user?.telegramId);
      
      const validation = bookingSchema.safeParse(req.body);
      if (!validation.success) {
        console.log('❌ Validation error:', validation.error);
        return res.status(400).json({ error: validation.error });
      }

      if (!req.user) {
        console.log('❌ No user in request');
        return res.status(401).send();
      }

      const appointment = await appointmentService.createAppointment(req.user.id, validation.data);
      console.log('✅ Appointment created:', appointment.id);
      
      // Notifications
      // Fetch Master and Service details
      const master = await db.query.users.findFirst({ where: eq(users.id, validation.data.masterId) });
      const service = await db.query.services.findFirst({ where: eq(services.id, validation.data.serviceId) });
      
      if (master && service) {
        // Получаем описание мастера из профиля
        const masterProfile = master.masterProfile as { displayName?: string; description?: string } | null;
        const masterDisplayName = masterProfile?.displayName || master.firstName || 'Мастер';
        const masterDescription = masterProfile?.description || null;

        // Notify Master
        await notificationService.notifyNewBooking(
            master.telegramId,
            req.user.firstName || 'Клиент',
            service.title,
            new Date(validation.data.dateStr),
            validation.data.timeStr
        );

        // Notify Client (с информацией о мастере)
        await notificationService.notifyBookingConfirmation(
            req.user.telegramId,
            masterDisplayName,
            masterDescription,
            service.title,
            new Date(validation.data.dateStr),
            validation.data.timeStr
        );
      }

      return res.json(appointment);
    } catch (error: any) {
      console.error('❌ Booking error:', error.message);
      return res.status(400).json({ error: error.message || 'Failed to book' });
    }
  },

  async list(req: Request, res: Response) {
    if (!req.user) return res.status(401).send();
    
    const appointments = await appointmentService.getAppointments(req.user.id, req.user.role as 'master' | 'client');
    return res.json(appointments);
  },

  async cancel(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).send();
      
      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: 'Invalid appointment ID' });
      }

      const appointment = await appointmentService.cancelAppointment(
        appointmentId, 
        req.user.id, 
        req.user.role as 'master' | 'client'
      );

      // Уведомление об отмене
      const master = await db.query.users.findFirst({ where: eq(users.id, appointment.masterId) });
      const client = await db.query.users.findFirst({ where: eq(users.id, appointment.clientId) });
      const service = appointment.serviceId 
        ? await db.query.services.findFirst({ where: eq(services.id, appointment.serviceId) })
        : null;

      if (master && client && service) {
        const masterProfile = master.masterProfile as { displayName?: string } | null;
        const masterDisplayName = masterProfile?.displayName || master.firstName || 'Мастер';
        const time = new Date(appointment.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        // Если отменил клиент — уведомляем мастера
        if (req.user.role === 'client') {
          await notificationService.notifyCancellation(
            master.telegramId,
            client.firstName || 'Клиент',
            service.title,
            new Date(appointment.startTime),
            time
          );
        }
        // Если отменил мастер — уведомляем клиента
        if (req.user.role === 'master') {
          await notificationService.notifyCancellation(
            client.telegramId,
            masterDisplayName,
            service.title,
            new Date(appointment.startTime),
            time,
            true
          );
        }
      }

      return res.json(appointment);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to cancel' });
    }
  }
};
