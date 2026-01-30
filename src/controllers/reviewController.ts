import { Request, Response } from 'express';
import { reviewService } from '../services/reviewService.js';
import { z } from 'zod';

const createReviewSchema = z.object({
  appointmentId: z.number().positive(),
  rating: z.number().min(1).max(5),
  comment: z.string().optional()
});

export const reviewController = {
  // Создать отзыв
  async createReview(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).send();

      const validation = createReviewSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error });
      }

      const { appointmentId, rating, comment } = validation.data;
      
      const review = await reviewService.createReview(
        appointmentId,
        req.user.id,
        rating,
        comment
      );

      return res.json({ review });
    } catch (error: any) {
      console.error('Create review error:', error);
      return res.status(400).json({ error: error.message || 'Failed to create review' });
    }
  },

  // Получить отзывы мастера
  async getMasterReviews(req: Request, res: Response) {
    try {
      const masterId = Number(req.params.masterId);
      if (isNaN(masterId)) {
        return res.status(400).json({ error: 'Invalid master ID' });
      }

      const reviews = await reviewService.getMasterReviews(masterId);
      const rating = await reviewService.getMasterAverageRating(masterId);

      return res.json({ reviews, rating });
    } catch (error) {
      console.error('Get reviews error:', error);
      return res.status(500).json({ error: 'Failed to get reviews' });
    }
  },

  // Проверить можно ли оставить отзыв
  async canLeaveReview(req: Request, res: Response) {
    try {
      if (!req.user) return res.status(401).send();

      const appointmentId = Number(req.params.appointmentId);
      if (isNaN(appointmentId)) {
        return res.status(400).json({ error: 'Invalid appointment ID' });
      }

      const canLeave = await reviewService.canLeaveReview(appointmentId, req.user.id);

      return res.json({ canLeaveReview: canLeave });
    } catch (error) {
      console.error('Can leave review error:', error);
      return res.status(500).json({ error: 'Failed to check review status' });
    }
  }
};
