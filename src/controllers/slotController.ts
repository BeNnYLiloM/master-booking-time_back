import { Request, Response } from 'express';
import { slotService } from '../services/slotService.js';

export const slotController = {
  async getSlots(req: Request, res: Response) {
    try {
      const { masterId, date } = req.query;

      if (!masterId || !date) {
        return res.status(400).json({ error: 'Missing masterId or date' });
      }

      const slots = await slotService.getAvailableSlots(Number(masterId), String(date));
      return res.json(slots);
    } catch (error: any) {
      console.error('Slot calculation error:', error);
      return res.status(400).json({ error: error.message || 'Failed to get slots' });
    }
  }
};

