import { Router } from 'express';
import { slotController } from '../controllers/slotController.js';
import { masterController } from '../controllers/masterController.js';

const router = Router();

router.get('/slots', slotController.getSlots);
router.get('/public/services/:masterId', masterController.getPublicServices);

export default router;
