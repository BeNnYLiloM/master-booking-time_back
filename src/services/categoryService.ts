import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { serviceCategories, services } from '../db/schema.js';

export const categoryService = {
  // Получить все категории мастера
  async getCategories(masterId: number) {
    return db.query.serviceCategories.findMany({
      where: eq(serviceCategories.masterId, masterId),
      orderBy: [asc(serviceCategories.order), asc(serviceCategories.id)],
    });
  },

  // Создать категорию
  async createCategory(masterId: number, data: { name: string; imageUrl?: string }) {
    // Получаем максимальный order для автоматической сортировки
    const categories = await db.query.serviceCategories.findMany({
      where: eq(serviceCategories.masterId, masterId),
    });
    
    const maxOrder = categories.reduce((max, cat) => Math.max(max, cat.order || 0), 0);

    const [category] = await db.insert(serviceCategories)
      .values({
        masterId,
        name: data.name,
        imageUrl: data.imageUrl,
        order: maxOrder + 1,
      })
      .returning();

    return category;
  },

  // Обновить категорию
  async updateCategory(categoryId: number, masterId: number, data: { name?: string; imageUrl?: string; order?: number }) {
    // Проверяем что категория принадлежит мастеру
    const category = await db.query.serviceCategories.findFirst({
      where: and(
        eq(serviceCategories.id, categoryId),
        eq(serviceCategories.masterId, masterId)
      ),
    });

    if (!category) {
      throw new Error('Категория не найдена');
    }

    const [updated] = await db.update(serviceCategories)
      .set({
        name: data.name,
        imageUrl: data.imageUrl,
        order: data.order,
      })
      .where(eq(serviceCategories.id, categoryId))
      .returning();

    return updated;
  },

  // Удалить категорию
  async deleteCategory(categoryId: number, masterId: number) {
    // Проверяем что категория принадлежит мастеру
    const category = await db.query.serviceCategories.findFirst({
      where: and(
        eq(serviceCategories.id, categoryId),
        eq(serviceCategories.masterId, masterId)
      ),
    });

    if (!category) {
      throw new Error('Категория не найдена');
    }

    // Отвязываем услуги от категории (устанавливаем categoryId = null)
    await db.update(services)
      .set({ categoryId: null })
      .where(eq(services.categoryId, categoryId));

    // Удаляем категорию
    await db.delete(serviceCategories)
      .where(eq(serviceCategories.id, categoryId));

    return { success: true };
  },

  // Получить категорию с услугами
  async getCategoryWithServices(categoryId: number, masterId: number) {
    const category = await db.query.serviceCategories.findFirst({
      where: and(
        eq(serviceCategories.id, categoryId),
        eq(serviceCategories.masterId, masterId)
      ),
      with: {
        services: {
          where: eq(services.isActive, true),
        },
      },
    });

    if (!category) {
      throw new Error('Категория не найдена');
    }

    return category;
  },

  // Обновить порядок категорий (массовое обновление)
  async updateCategoriesOrder(masterId: number, categoryOrders: { id: number; order: number }[]) {
    // Проверяем что все категории принадлежат мастеру
    const categories = await db.query.serviceCategories.findMany({
      where: eq(serviceCategories.masterId, masterId),
    });

    const categoryIds = categories.map(c => c.id);

    for (const { id, order } of categoryOrders) {
      if (!categoryIds.includes(id)) {
        throw new Error(`Категория ${id} не принадлежит мастеру`);
      }

      await db.update(serviceCategories)
        .set({ order })
        .where(eq(serviceCategories.id, id));
    }

    return { success: true };
  },
};
