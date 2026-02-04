import { Request, Response } from 'express';
import { categoryService } from '../services/categoryService.js';
import { deleteImage } from '../utils/cloudinary.js';

export const categoryController = {
  // GET /master/categories
  async getCategories(req: Request, res: Response) {
    try {
      const masterId = req.user!.id;
      const categories = await categoryService.getCategories(masterId);
      res.json({ categories });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  // POST /master/categories
  async createCategory(req: Request, res: Response) {
    try {
      const masterId = req.user!.id;
      const { name, imageUrl } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Название категории обязательно' });
      }

      const category = await categoryService.createCategory(masterId, { name, imageUrl });
      res.status(201).json({ category });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  // PUT /master/categories/:id
  async updateCategory(req: Request, res: Response) {
    try {
      const masterId = req.user!.id;
      const categoryId = parseInt(req.params.id);
      const { name, imageUrl, order } = req.body;

      if (isNaN(categoryId)) {
        return res.status(400).json({ error: 'Неверный ID категории' });
      }

      const category = await categoryService.updateCategory(categoryId, masterId, { name, imageUrl, order });
      res.json({ category });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  },

  // DELETE /master/categories/:id
  async deleteCategory(req: Request, res: Response) {
    try {
      const masterId = req.user!.id;
      const categoryId = parseInt(req.params.id);

      if (isNaN(categoryId)) {
        return res.status(400).json({ error: 'Неверный ID категории' });
      }

      await categoryService.deleteCategory(categoryId, masterId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  },

  // GET /master/categories/:id/services
  async getCategoryWithServices(req: Request, res: Response) {
    try {
      const masterId = req.user!.id;
      const categoryId = parseInt(req.params.id);

      if (isNaN(categoryId)) {
        return res.status(400).json({ error: 'Неверный ID категории' });
      }

      const category = await categoryService.getCategoryWithServices(categoryId, masterId);
      res.json({ category });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  },

  // POST /master/categories/reorder
  async reorderCategories(req: Request, res: Response) {
    try {
      const masterId = req.user!.id;
      const { categoryOrders } = req.body;

      if (!Array.isArray(categoryOrders)) {
        return res.status(400).json({ error: 'categoryOrders должен быть массивом' });
      }

      await categoryService.updateCategoriesOrder(masterId, categoryOrders);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  // POST /master/categories/:id/image
  async uploadCategoryImage(req: Request, res: Response) {
    try {
      const masterId = req.user!.id;
      const categoryId = parseInt(req.params.id);

      if (isNaN(categoryId)) {
        return res.status(400).json({ error: 'Неверный ID категории' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
      }

      const imageUrl = (req.file as any).path;
      const category = await categoryService.updateCategory(categoryId, masterId, { imageUrl });
      
      res.json({ category });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  // DELETE /master/categories/:id/image
  async deleteCategoryImage(req: Request, res: Response) {
    try {
      const masterId = req.user!.id;
      const categoryId = parseInt(req.params.id);

      if (isNaN(categoryId)) {
        return res.status(400).json({ error: 'Неверный ID категории' });
      }

      const category = await categoryService.getCategoryWithServices(categoryId, masterId);
      
      if (category.imageUrl) {
        await deleteImage(category.imageUrl);
      }

      const updated = await categoryService.updateCategory(categoryId, masterId, { imageUrl: undefined });
      res.json({ category: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  // GET /public/categories/:masterId - Публичный доступ к категориям мастера
  async getPublicCategories(req: Request, res: Response) {
    try {
      const masterId = parseInt(req.params.masterId);

      if (isNaN(masterId)) {
        return res.status(400).json({ error: 'Неверный ID мастера' });
      }

      const categories = await categoryService.getCategories(masterId);
      res.json({ categories });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
