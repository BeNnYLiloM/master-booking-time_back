import { Request, Response } from 'express';
import { slotService } from '../services/slotService.js';
import { db } from '../db/index.js';
import { services } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export const slotController = {
  async getSlots(req: Request, res: Response) {
    try {
      const { masterId, date, serviceId } = req.query;

      if (!masterId || !date || !serviceId) {
        return res.status(400).json({ error: 'Missing masterId, date or serviceId' });
      }

      // Получаем информацию об услуге для определения длительности
      const service = await db.query.services.findFirst({
        where: eq(services.id, Number(serviceId))
      });

      if (!service) {
        return res.status(404).json({ error: 'Service not found' });
      }

      const slots = await slotService.getAvailableSlots(
        Number(masterId), 
        String(date),
        service.duration
      );
      
      return res.json(slots);
    } catch (error: any) {
      console.error('Slot calculation error:', error);
      return res.status(400).json({ error: error.message || 'Failed to get slots' });
    }
  }
};

