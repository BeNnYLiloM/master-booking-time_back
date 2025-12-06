import { Request, Response } from 'express';
import { validateTelegramData } from '../utils/telegram.js';
import { authService } from '../services/authService.js';

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { initData } = req.body;
      const botToken = process.env.BOT_TOKEN;

      // DEV MODE: Если нет initData и мы в dev-режиме, используем тестового пользователя
      if (!initData && process.env.NODE_ENV !== 'production') {
        const devUser = await authService.loginOrRegister(123456789, {
          firstName: 'Dev User',
          username: 'dev_user',
        });
        return res.json({ user: devUser });
      }

      if (!botToken) {
        return res.status(500).json({ error: 'Bot token not configured' });
      }

      const telegramUser = validateTelegramData(initData, botToken);

      if (!telegramUser) {
        return res.status(401).json({ error: 'Invalid Telegram data' });
      }

      const user = await authService.loginOrRegister(telegramUser.id, {
        firstName: telegramUser.first_name,
        username: telegramUser.username,
      });

      return res.json({ user });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  async becomeMaster(req: Request, res: Response) {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const updatedUser = await authService.becomeMaster(user.id);
      
      return res.json({ user: updatedUser });
    } catch (error) {
      console.error('Become master error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
};

