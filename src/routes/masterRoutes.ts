import { Router } from 'express';
import { masterController } from '../controllers/masterController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { uploadServiceImage, uploadAvatar } from '../utils/cloudinary.js';

const router = Router();

router.use(authMiddleware);

router.get('/profile', masterController.getProfile);
router.put('/profile', masterController.updateProfile);
router.post('/profile/avatar', uploadAvatar.single('avatar'), masterController.uploadAvatar);
router.delete('/profile/avatar', masterController.deleteAvatar);

router.post('/services', masterController.createService);
router.get('/services', masterController.getServices);
router.put('/services/:id/image', uploadServiceImage.single('image'), masterController.updateServiceImage);
router.delete('/services/:id/image', masterController.deleteServiceImage);
router.delete('/services/:id', masterController.deleteService);

export default router;

