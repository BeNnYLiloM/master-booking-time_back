import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

export const authService = {
  async loginOrRegister(telegramId: number, userData: { firstName: string; username?: string }) {
    // Check if user exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.telegramId, String(telegramId)),
    });

    if (existingUser) {
      // Update info if changed
      if (existingUser.firstName !== userData.firstName || existingUser.username !== userData.username) {
        await db
          .update(users)
          .set({
            firstName: userData.firstName,
            username: userData.username,
          })
          .where(eq(users.id, existingUser.id));
        
        return { ...existingUser, firstName: userData.firstName, username: userData.username };
      }
      return existingUser;
    }

    // Create new user
    const [newUser] = await db
      .insert(users)
      .values({
        telegramId: String(telegramId),
        firstName: userData.firstName,
        username: userData.username,
        role: 'client', // Default role
      })
      .returning();

    return newUser;
  },

  async getUserById(id: number) {
    return db.query.users.findFirst({
      where: eq(users.id, id),
    });
  },

  async becomeMaster(userId: number) {
    const [updatedUser] = await db
      .update(users)
      .set({
        role: 'master',
        masterProfile: {
          displayName: '',
          description: '',
          workingDates: {}
        },
      })
      .where(eq(users.id, userId))
      .returning();

    return updatedUser;
  }
};

