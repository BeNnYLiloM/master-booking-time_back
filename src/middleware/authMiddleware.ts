import { Request, Response, NextFunction } from 'express';
import { validateTelegramData } from '../utils/telegram.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: typeof users.$inferSelect;
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const initData = req.header('X-Telegram-Init-Data');
  const botToken = process.env.BOT_TOKEN;

  // DEV MODE: Если нет initData и мы не в production, используем тестового пользователя
  if (!initData && process.env.NODE_ENV !== 'production') {
    try {
      // Ищем тестового пользователя (или первого в базе)
      const devUser = await db.query.users.findFirst({
        where: eq(users.telegramId, '123456789'),
      });

      if (devUser) {
        req.user = devUser;
        return next();
      }
    } catch (error) {
      console.error('Dev auth error:', error);
    }
    return res.status(401).json({ error: 'Dev user not found. Run npm run db:seed first.' });
  }

  if (!initData || !botToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const telegramUser = validateTelegramData(initData, botToken);

  if (!telegramUser) {
    return res.status(401).json({ error: 'Invalid authentication data' });
  }

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.telegramId, String(telegramUser.id)),
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

