import { Router } from 'express';
import { masterController } from '../controllers/masterController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.put('/profile', masterController.updateProfile);
router.post('/services', masterController.createService);
router.get('/services', masterController.getServices);
router.delete('/services/:id', masterController.deleteService);

export default router;

