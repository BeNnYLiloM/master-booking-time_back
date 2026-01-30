import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, services } from '../db/schema.js';
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

  async createService(userId: number, data: { title: string; price: number; duration: number; currency: string; locationType?: string; imageUrl?: string }) {
    const [newService] = await db.insert(services)
      .values({
        masterId: userId,
        title: data.title,
        price: data.price,
        duration: data.duration,
        currency: data.currency,
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
    const currentProfile = user.masterProfile as { avatarUrl?: string } | null;
    if (currentProfile?.avatarUrl) {
      await deleteImage(currentProfile.avatarUrl);
    }

    // Обновляем профиль с новым аватаром
    const updatedProfile = {
      workingDates: {},
      ...(currentProfile || {}),
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

    const currentProfile = user.masterProfile as { avatarUrl?: string } | null;
    if (currentProfile?.avatarUrl) {
      await deleteImage(currentProfile.avatarUrl);
    }

    // Удаляем avatarUrl из профиля
    const updatedProfile = {
      workingDates: {},
      ...(currentProfile || {}),
      avatarUrl: undefined
    };

    await db.update(users)
      .set({ masterProfile: updatedProfile })
      .where(eq(users.id, userId));

    return db.query.users.findFirst({
      where: eq(users.id, userId)
    });
  }
};

