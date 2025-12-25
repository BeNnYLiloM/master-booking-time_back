import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, services } from '../db/schema.js';

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

  async createService(userId: number, data: { title: string; price: number; duration: number; currency: string }) {
    const [newService] = await db.insert(services)
      .values({
        masterId: userId,
        title: data.title,
        price: data.price,
        duration: data.duration,
        currency: data.currency
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
    // Soft delete or hard delete? Spec says "Remove". Soft delete via isActive is safer usually, 
    // but schema has isActive. Let's use isActive = false (soft delete) to preserve history of appointments.
    // Or actually delete? Let's stick to isActive = false.
    
    const [updated] = await db.update(services)
      .set({ isActive: false })
      .where(and(
        eq(services.id, serviceId),
        eq(services.masterId, userId)
      ))
      .returning();
    return updated;
  }
};

