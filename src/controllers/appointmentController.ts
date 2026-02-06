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
  comment: z.string().optional(),
  locationType: z.enum(['at_master', 'at_client']).optional(),
  address: z.object({
    text: z.string(),
    coordinates: z.tuple([z.number(), z.number()]) // [lat, lng]
  }).optional()
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

        // Notify Master (с inline-кнопками подтверждения)
        await notificationService.notifyNewBooking(
            master.telegramId,
            appointment.id,
            req.user.firstName || 'Клиент',
            service.title,
            new Date(validation.data.dateStr),
            validation.data.timeStr
        );

        // Notify Client (заявка отправлена, ожидает подтверждения)
        await notificationService.notifyBookingPending(
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

  async getOne(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).send();
      
      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: 'Invalid appointment ID' });
      }

      const appointment = await appointmentService.getAppointmentById(appointmentId);
      
      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      // Проверяем что пользователь имеет доступ к этой записи
      if (appointment.clientId !== req.user.id && appointment.masterId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      return res.json(appointment);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to get appointment' });
    }
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
  },

  async confirm(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).send();
      if (req.user.role !== 'master') return res.status(403).json({ error: 'Only master can confirm' });
      
      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: 'Invalid appointment ID' });
      }

      // Получаем данные до подтверждения
      const fullAppointment = await appointmentService.getAppointmentById(appointmentId);
      
      // Подтверждаем
      const appointment = await appointmentService.confirmAppointment(appointmentId, req.user.id);

      // Уведомляем клиента
      if (fullAppointment && fullAppointment.client && fullAppointment.service) {
        const masterProfile = req.user.masterProfile as { displayName?: string; description?: string } | null;
        const masterName = masterProfile?.displayName || req.user.firstName || 'Мастер';
        const masterDescription = masterProfile?.description || null;
        const time = new Date(fullAppointment.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        await notificationService.notifyBookingConfirmed(
          fullAppointment.client.telegramId,
          masterName,
          masterDescription,
          fullAppointment.service.title,
          new Date(fullAppointment.startTime),
          time
        );
      }

      return res.json(appointment);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to confirm' });
    }
  },

  async reject(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).send();
      if (req.user.role !== 'master') return res.status(403).json({ error: 'Only master can reject' });
      
      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: 'Invalid appointment ID' });
      }

      // Получаем данные до отклонения
      const fullAppointment = await appointmentService.getAppointmentById(appointmentId);

      // Отклоняем
      const appointment = await appointmentService.rejectAppointment(appointmentId, req.user.id);

      // Уведомляем клиента
      if (fullAppointment && fullAppointment.client && fullAppointment.service) {
        const masterProfile = req.user.masterProfile as { displayName?: string } | null;
        const masterName = masterProfile?.displayName || req.user.firstName || 'Мастер';
        const time = new Date(fullAppointment.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        await notificationService.notifyBookingRejected(
          fullAppointment.client.telegramId,
          masterName,
          fullAppointment.service.title,
          new Date(fullAppointment.startTime),
          time
        );
      }

      return res.json(appointment);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to reject' });
    }
  },

  // Мастер отмечает что услуга оказана
  async markComplete(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).send();
      if (req.user.role !== 'master') return res.status(403).json({ error: 'Only master can mark as complete' });
      
      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: 'Invalid appointment ID' });
      }

      // Получаем данные до изменения
      const fullAppointment = await appointmentService.getAppointmentById(appointmentId);
      
      // Отмечаем как ожидающую подтверждения
      const appointment = await appointmentService.markAsAwaitingReview(appointmentId, req.user.id);

      // Уведомляем клиента
      if (fullAppointment && fullAppointment.client && fullAppointment.service) {
        const masterProfile = req.user.masterProfile as { displayName?: string } | null;
        const masterName = masterProfile?.displayName || req.user.firstName || 'Мастер';
        const time = new Date(fullAppointment.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        await notificationService.notifyAwaitingReview(
          fullAppointment.client.telegramId,
          appointmentId,
          masterName,
          fullAppointment.service.title,
          new Date(fullAppointment.startTime),
          time
        );
      }

      return res.json(appointment);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to mark complete' });
    }
  },

  // Клиент подтверждает завершение
  async confirmComplete(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).send();
      
      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: 'Invalid appointment ID' });
      }

      // Получаем данные до изменения
      const fullAppointment = await appointmentService.getAppointmentById(appointmentId);
      
      // Подтверждаем завершение
      const appointment = await appointmentService.confirmCompletion(appointmentId, req.user.id);

      // Уведомляем мастера
      if (fullAppointment && fullAppointment.master && fullAppointment.service) {
        const time = new Date(fullAppointment.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        await notificationService.notifyCompletionConfirmed(
          fullAppointment.master.telegramId,
          req.user.firstName || 'Клиент',
          fullAppointment.service.title,
          new Date(fullAppointment.startTime),
          time
        );
      }

      return res.json(appointment);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to confirm completion' });
    }
  },

  // Клиент оспаривает завершение
  async disputeComplete(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).send();
      
      const appointmentId = parseInt(req.params.id);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: 'Invalid appointment ID' });
      }

      // Получаем данные до изменения
      const fullAppointment = await appointmentService.getAppointmentById(appointmentId);
      
      // Оспариваем
      const appointment = await appointmentService.disputeCompletion(appointmentId, req.user.id);

      // Уведомляем мастера
      if (fullAppointment && fullAppointment.master && fullAppointment.service) {
        const time = new Date(fullAppointment.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        
        await notificationService.notifyCompletionDisputed(
          fullAppointment.master.telegramId,
          req.user.firstName || 'Клиент',
          fullAppointment.service.title,
          new Date(fullAppointment.startTime),
          time
        );
      }

      return res.json(appointment);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Failed to dispute completion' });
    }
  }
};
