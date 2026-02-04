import { eq, and, gte, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, services, appointments } from '../db/schema.js';
import { deleteImage } from '../utils/cloudinary.js';

export const masterService = {
  async getProfile(userId: number) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });
    
    if (!user) return null;
    
    const defaultProfile = {
      displayName: '',
      description: '',
      workingDates: {} as Record<string, { start: string; end: string }>
    };
    
    return {
      ...defaultProfile,
      ...(user.masterProfile as object || {})
    };
  },

  async updateProfile(userId: number, profileData: {
    displayName?: string;
    description?: string;
    phoneNumber?: string;
    workingDates: {
      [date: string]: {
        start: string;
        end: string;
      };
    };
  }) {
    // Ensure user is master
    await db.update(users)
      .set({ 
        role: 'master',
        masterProfile: profileData 
      })
      .where(eq(users.id, userId));
    
    return db.query.users.findFirst({
        where: eq(users.id, userId)
    });
  },

  async createService(userId: number, data: { title: string; description?: string; price: number; duration: number; currency: string; categoryId?: number | null; locationType?: string; imageUrl?: string }) {
    const [newService] = await db.insert(services)
      .values({
        masterId: userId,
        title: data.title,
        description: data.description,
        price: data.price,
        duration: data.duration,
        currency: data.currency,
        categoryId: data.categoryId,
        locationType: (data.locationType as 'at_master' | 'at_client' | 'both') || 'at_master',
        imageUrl: data.imageUrl
      })
      .returning();
    return newService;
  },

  async getServices(userId: number) {
    return db.query.services.findMany({
      where: and(
        eq(services.masterId, userId),
        eq(services.isActive, true)
      )
    });
  },

  async updateService(serviceId: number, userId: number, data: {
    title?: string;
    description?: string;
    price?: number;
    duration?: number;
    currency?: string;
    categoryId?: number | null;
    locationType?: 'at_master' | 'at_client' | 'both';
  }) {
    const [updated] = await db.update(services)
      .set(data)
      .where(and(
        eq(services.id, serviceId),
        eq(services.masterId, userId)
      ))
      .returning();
    return updated;
  },

  async deleteService(serviceId: number, userId: number) {
    // Получаем услугу чтобы удалить изображение из Cloudinary
    const service = await db.query.services.findFirst({
      where: and(
        eq(services.id, serviceId),
        eq(services.masterId, userId)
      )
    });

    if (service?.imageUrl) {
      await deleteImage(service.imageUrl);
    }
    
    // Soft delete via isActive = false to preserve history of appointments
    const [updated] = await db.update(services)
      .set({ isActive: false })
      .where(and(
        eq(services.id, serviceId),
        eq(services.masterId, userId)
      ))
      .returning();
    return updated;
  },

  async updateServiceImage(serviceId: number, userId: number, imageUrl: string) {
    // Получаем текущую услугу для удаления старого изображения
    const service = await db.query.services.findFirst({
      where: and(
        eq(services.id, serviceId),
        eq(services.masterId, userId)
      )
    });

    if (!service) {
      throw new Error('Service not found');
    }

    // Удаляем старое изображение если оно есть
    if (service.imageUrl) {
      await deleteImage(service.imageUrl);
    }

    // Обновляем URL нового изображения
    const [updated] = await db.update(services)
      .set({ imageUrl })
      .where(and(
        eq(services.id, serviceId),
        eq(services.masterId, userId)
      ))
      .returning();

    return updated;
  },

  async deleteServiceImage(serviceId: number, userId: number) {
    const service = await db.query.services.findFirst({
      where: and(
        eq(services.id, serviceId),
        eq(services.masterId, userId)
      )
    });

    if (!service) {
      throw new Error('Service not found');
    }

    if (service.imageUrl) {
      await deleteImage(service.imageUrl);
    }

    const [updated] = await db.update(services)
      .set({ imageUrl: null })
      .where(and(
        eq(services.id, serviceId),
        eq(services.masterId, userId)
      ))
      .returning();

    return updated;
  },

  async updateAvatar(userId: number, avatarUrl: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Удаляем старый аватар если есть
    const currentProfile = user.masterProfile as { avatarUrl?: string; workingDates?: Record<string, { start: string; end: string }> } | null;
    if (currentProfile?.avatarUrl) {
      await deleteImage(currentProfile.avatarUrl);
    }

    // Обновляем профиль с новым аватаром, сохраняя все существующие поля
    const updatedProfile = {
      ...(currentProfile || {}),
      workingDates: currentProfile?.workingDates || {},
      avatarUrl
    };

    await db.update(users)
      .set({ masterProfile: updatedProfile })
      .where(eq(users.id, userId));

    return db.query.users.findFirst({
      where: eq(users.id, userId)
    });
  },

  async deleteAvatar(userId: number) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) {
      throw new Error('User not found');
    }

    const currentProfile = user.masterProfile as { avatarUrl?: string; workingDates?: Record<string, { start: string; end: string }> } | null;
    if (currentProfile?.avatarUrl) {
      await deleteImage(currentProfile.avatarUrl);
    }

    // Удаляем avatarUrl из профиля, сохраняя все остальные поля
    const { avatarUrl, ...restProfile } = currentProfile || {};
    const updatedProfile = {
      ...restProfile,
      workingDates: currentProfile?.workingDates || {}
    };

    await db.update(users)
      .set({ masterProfile: updatedProfile })
      .where(eq(users.id, userId));

    return db.query.users.findFirst({
      where: eq(users.id, userId)
    });
  },

  async getStats(userId: number) {
    const now = new Date();
    
    // Начало текущей недели (понедельник)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);
    
    // Начало текущего месяца
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Получаем записи за неделю (завершённые и подтверждённые)
    const weekAppointments = await db.query.appointments.findMany({
      where: and(
        eq(appointments.masterId, userId),
        gte(appointments.startTime, weekStart)
      ),
      with: {
        service: true
      }
    });
    
    // Получаем записи за месяц
    const monthAppointments = await db.query.appointments.findMany({
      where: and(
        eq(appointments.masterId, userId),
        gte(appointments.startTime, monthStart)
      ),
      with: {
        service: true
      }
    });
    
    // Подсчёт завершённых записей за неделю
    const weekCompletedCount = weekAppointments.filter(a => 
      a.status === 'completed'
    ).length;
    
    // Подсчёт завершённых записей за месяц
    const monthCompletedCount = monthAppointments.filter(a => 
      a.status === 'completed'
    ).length;
    
    // Подсчёт выручки за неделю (только завершённые)
    const weekRevenue = weekAppointments
      .filter(a => a.status === 'completed' && a.service)
      .reduce((sum, a) => sum + (a.service?.price || 0), 0);
    
    // Подсчёт выручки за месяц (только завершённые)
    const monthRevenue = monthAppointments
      .filter(a => a.status === 'completed' && a.service)
      .reduce((sum, a) => sum + (a.service?.price || 0), 0);
    
    // Поиск самой популярной услуги (по количеству завершённых записей за всё время)
    const serviceStats = await db
      .select({
        serviceId: appointments.serviceId,
        count: sql<number>`count(*)::int`
      })
      .from(appointments)
      .where(and(
        eq(appointments.masterId, userId),
        eq(appointments.status, 'completed')
      ))
      .groupBy(appointments.serviceId)
      .orderBy(sql`count(*) DESC`)
      .limit(1);
    
    let popularService = null;
    if (serviceStats.length > 0 && serviceStats[0].serviceId) {
      popularService = await db.query.services.findFirst({
        where: eq(services.id, serviceStats[0].serviceId)
      });
    }
    
    return {
      week: {
        appointments: weekCompletedCount,
        revenue: weekRevenue
      },
      month: {
        appointments: monthCompletedCount,
        revenue: monthRevenue
      },
      popularService: popularService ? {
        title: popularService.title,
        count: serviceStats[0].count
      } : null
    };
  }
};

