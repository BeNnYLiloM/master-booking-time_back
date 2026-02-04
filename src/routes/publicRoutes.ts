import { Router } from 'express';
import { slotController } from '../controllers/slotController.js';
import { masterController } from '../controllers/masterController.js';
import { categoryController } from '../controllers/categoryController.js';

const router = Router();

router.get('/slots', slotController.getSlots);
router.get('/public/services/:masterId', masterController.getPublicServices);
router.get('/public/master/:masterId', masterController.getPublicMaster);
router.get('/public/categories/:masterId', categoryController.getPublicCategories);

export default router;
