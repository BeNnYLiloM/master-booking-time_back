import { Router } from 'express';
import { appointmentController } from '../controllers/appointmentController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);
router.post('/', appointmentController.create);
router.get('/', appointmentController.list);

export default router;

