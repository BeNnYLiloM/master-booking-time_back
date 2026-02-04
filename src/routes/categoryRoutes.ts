import { Router } from 'express';
import { categoryController } from '../controllers/categoryController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { uploadCategoryImage } from '../utils/cloudinary.js';

const router = Router();

// Все роуты требуют авторизации
router.use(authMiddleware);

// CRUD категорий
router.get('/categories', categoryController.getCategories);
router.post('/categories', categoryController.createCategory);
router.put('/categories/:id', categoryController.updateCategory);
router.delete('/categories/:id', categoryController.deleteCategory);

// Получить категорию с услугами
router.get('/categories/:id/services', categoryController.getCategoryWithServices);

// Изменить порядок категорий
router.post('/categories/reorder', categoryController.reorderCategories);

// Загрузка и удаление изображений категорий
router.post('/categories/:id/image', uploadCategoryImage.single('image'), categoryController.uploadCategoryImage);
router.delete('/categories/:id/image', categoryController.deleteCategoryImage);

export default router;
