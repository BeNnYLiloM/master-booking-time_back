import { Request, Response } from 'express';
import { masterService } from '../services/masterService.js';
import { z } from 'zod';

const profileSchema = z.object({
  displayName: z.string().optional(),
  description: z.string().optional(),
  workStartHour: z.number().min(0).max(23),
  workEndHour: z.number().min(0).max(23),
  slotDuration: z.number().min(15).max(180), // 15 min to 3 hours
  daysOff: z.array(z.number().min(0).max(6))
});

const serviceSchema = z.object({
  title: z.string().min(1),
  price: z.number().positive(),
  duration: z.number().positive(),
  currency: z.string().default('RUB')
});

export const masterController = {
  async updateProfile(req: Request, res: Response) {
    try {
      const validation = profileSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error });
      }

      if (!req.user) return res.status(401).send();

      const updatedUser = await masterService.updateProfile(req.user.id, validation.data);
      return res.json({ user: updatedUser });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to update profile' });
    }
  },

  async createService(req: Request, res: Response) {
    try {
      const validation = serviceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error });
      }

      if (!req.user) return res.status(401).send();

      const service = await masterService.createService(req.user.id, validation.data);
      return res.json({ service });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to create service' });
    }
  },

  async getServices(req: Request, res: Response) {
    if (!req.user) return res.status(401).send();
    const services = await masterService.getServices(req.user.id);
    return res.json({ services });
  },

  async getPublicServices(req: Request, res: Response) {
      const masterId = Number(req.params.masterId);
      if (isNaN(masterId)) return res.status(400).json({ error: 'Invalid Master ID' });
      
      const services = await masterService.getServices(masterId);
      return res.json({ services });
  },

  async deleteService(req: Request, res: Response) {
    if (!req.user) return res.status(401).send();
    const serviceId = Number(req.params.id);
    if (isNaN(serviceId)) return res.status(400).json({ error: 'Invalid ID' });

    const deleted = await masterService.deleteService(serviceId, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Service not found or not owned by you' });
    
    return res.json({ success: true });
  }
};
