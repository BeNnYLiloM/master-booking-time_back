import { Router } from 'express';
import { reviewController } from '../controllers/reviewController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Публичный endpoint для получения отзывов мастера
router.get('/master/:masterId', reviewController.getMasterReviews);

// Защищённые endpoints
router.use(authMiddleware);

router.post('/', reviewController.createReview);
router.get('/can-leave/:appointmentId', reviewController.canLeaveReview);

export default router;
