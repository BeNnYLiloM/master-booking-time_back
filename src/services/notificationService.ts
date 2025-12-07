import { bot } from '../bot.js';
import { users, services, appointments } from '../db/schema.js';

// Форматирование даты на русском
const formatDateRu = (date: Date) => {
  return date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
};

export const notificationService = {
  async notifyNewBooking(
    masterTelegramId: string, 
    clientName: string, 
    serviceTitle: string, 
    date: Date, 
    time: string
  ) {
    if (!bot) return;

    try {
      const dateStr = formatDateRu(date);
      
      const message = `🎉 *Новая запись!*\n\n` +
        `👤 Клиент: *${clientName}*\n` +
        `💇‍♀️ Услуга: ${serviceTitle}\n` +
        `📅 ${dateStr}\n` +
        `⏰ Время: ${time}\n\n` +
        `Откройте приложение для управления записями.`;

      await bot.telegram.sendMessage(masterTelegramId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Failed to send notification to master:', error);
    }
  },

  async notifyBookingConfirmation(
    clientTelegramId: string,
    masterName: string,
    masterDescription: string | null,
    serviceTitle: string,
    date: Date,
    time: string
  ) {
    if (!bot) return;

    try {
      const dateStr = formatDateRu(date);
      const masterInfo = masterDescription 
        ? `👩‍💼 Мастер: *${masterName}* (${masterDescription})`
        : `👩‍💼 Мастер: *${masterName}*`;
      
      const message = `✅ *Вы записаны!*\n\n` +
        `${masterInfo}\n` +
        `💇‍♀️ Услуга: ${serviceTitle}\n` +
        `📅 ${dateStr}\n` +
        `⏰ Время: ${time}\n\n` +
        `Ждём вас! Вы можете отменить запись в приложении.`;
  
      await bot.telegram.sendMessage(clientTelegramId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Failed to send confirmation to client:', error);
    }
  },

  async notifyCancellation(
    telegramId: string,
    cancelledBy: string,
    serviceTitle: string,
    date: Date,
    time: string,
    byMaster: boolean = false
  ) {
    if (!bot) return;

    try {
      const dateStr = formatDateRu(date);

      const message = byMaster
        ? `❌ *Запись отменена*\n\n` +
          `Мастер *${cancelledBy}* отменил вашу запись.\n\n` +
          `💇‍♀️ Услуга: ${serviceTitle}\n` +
          `📅 ${dateStr}\n` +
          `⏰ Время: ${time}\n\n` +
          `Вы можете записаться на другое время.`
        : `❌ *Запись отменена клиентом*\n\n` +
          `Клиент *${cancelledBy}* отменил запись.\n\n` +
          `💇‍♀️ Услуга: ${serviceTitle}\n` +
          `📅 ${dateStr}\n` +
          `⏰ Время: ${time}`;

      await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Failed to send cancellation notification:', error);
    }
  }
};

