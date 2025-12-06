import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/login', authController.login);
router.post('/become-master', authMiddleware, authController.becomeMaster);

export default router;

