import { bot } from '../bot.js';
import { Markup } from 'telegraf';

// Форматирование даты на русском
const formatDateRu = (date: Date) => {
  return date.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
};

export const notificationService = {
  // Уведомление мастеру о новой записи (с кнопками подтверждения)
  async notifyNewBooking(
    masterTelegramId: string, 
    appointmentId: number,
    clientName: string, 
    serviceTitle: string, 
    date: Date, 
    time: string
  ) {
    if (!bot) return;

    try {
      const dateStr = formatDateRu(date);
      
      const message = `🔔 *Новая заявка на запись!*\n\n` +
        `👤 Клиент: *${clientName}*\n` +
        `💇‍♀️ Услуга: ${serviceTitle}\n` +
        `📅 ${dateStr}\n` +
        `⏰ Время: ${time}\n\n` +
        `Подтвердите или отклоните запись:`;

      await bot.telegram.sendMessage(masterTelegramId, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          Markup.button.callback('✅ Подтвердить', `confirm_${appointmentId}`),
          Markup.button.callback('❌ Отклонить', `reject_${appointmentId}`)
        ])
      });
    } catch (error) {
      console.error('Failed to send notification to master:', error);
    }
  },

  // Уведомление клиенту что заявка принята (ожидает подтверждения)
  async notifyBookingPending(
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
      
      const message = `⏳ *Заявка отправлена!*\n\n` +
        `${masterInfo}\n` +
        `💇‍♀️ Услуга: ${serviceTitle}\n` +
        `📅 ${dateStr}\n` +
        `⏰ Время: ${time}\n\n` +
        `Ожидайте подтверждения от мастера.`;
  
      await bot.telegram.sendMessage(clientTelegramId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Failed to send pending notification to client:', error);
    }
  },

  // Уведомление клиенту о подтверждении записи
  async notifyBookingConfirmed(
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
      
      const message = `✅ *Запись подтверждена!*\n\n` +
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

  // Уведомление клиенту об отклонении записи
  async notifyBookingRejected(
    clientTelegramId: string,
    masterName: string,
    serviceTitle: string,
    date: Date,
    time: string
  ) {
    if (!bot) return;

    try {
      const dateStr = formatDateRu(date);
      
      const message = `😔 *Запись отклонена*\n\n` +
        `Мастер *${masterName}* не смог подтвердить вашу запись.\n\n` +
        `💇‍♀️ Услуга: ${serviceTitle}\n` +
        `📅 ${dateStr}\n` +
        `⏰ Время: ${time}\n\n` +
        `Попробуйте выбрать другое время.`;
  
      await bot.telegram.sendMessage(clientTelegramId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Failed to send rejection to client:', error);
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
  },

  // Уведомление клиенту о завершении услуги (с кнопками подтверждения)
  async notifyAwaitingReview(
    clientTelegramId: string,
    appointmentId: number,
    masterName: string,
    serviceTitle: string,
    date: Date,
    time: string
  ) {
    if (!bot) return;

    try {
      const dateStr = formatDateRu(date);
      
      const message = `🎉 *Услуга оказана!*\n\n` +
        `Мастер *${masterName}* отметил, что услуга выполнена.\n\n` +
        `💇‍♀️ Услуга: ${serviceTitle}\n` +
        `📅 ${dateStr}\n` +
        `⏰ Время: ${time}\n\n` +
        `Пожалуйста, подтвердите:`;

      await bot.telegram.sendMessage(clientTelegramId, message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          Markup.button.callback('✅ Подтверждаю', `complete_confirm_${appointmentId}`),
          Markup.button.callback('❌ Оспорить', `complete_dispute_${appointmentId}`)
        ])
      });
    } catch (error) {
      console.error('Failed to send awaiting review notification:', error);
    }
  },

  // Уведомление мастеру о подтверждении завершения
  async notifyCompletionConfirmed(
    masterTelegramId: string,
    clientName: string,
    serviceTitle: string,
    date: Date,
    time: string
  ) {
    if (!bot) return;

    try {
      const dateStr = formatDateRu(date);
      
      const message = `✅ *Услуга подтверждена клиентом!*\n\n` +
        `Клиент *${clientName}* подтвердил выполнение услуги.\n\n` +
        `💇‍♀️ Услуга: ${serviceTitle}\n` +
        `📅 ${dateStr}\n` +
        `⏰ Время: ${time}`;

      await bot.telegram.sendMessage(masterTelegramId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Failed to send completion confirmed notification:', error);
    }
  },

  // Уведомление мастеру об оспаривании
  async notifyCompletionDisputed(
    masterTelegramId: string,
    clientName: string,
    serviceTitle: string,
    date: Date,
    time: string
  ) {
    if (!bot) return;

    try {
      const dateStr = formatDateRu(date);
      
      const message = `⚠️ *Клиент оспорил завершение!*\n\n` +
        `Клиент *${clientName}* не подтвердил выполнение услуги.\n` +
        `Запись возвращена в статус "Подтверждено".\n\n` +
        `💇‍♀️ Услуга: ${serviceTitle}\n` +
        `📅 ${dateStr}\n` +
        `⏰ Время: ${time}\n\n` +
        `Свяжитесь с клиентом для уточнения.`;

      await bot.telegram.sendMessage(masterTelegramId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Failed to send completion disputed notification:', error);
    }
  }
};

