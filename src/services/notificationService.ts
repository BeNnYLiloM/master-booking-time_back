import { bot } from '../bot.js';
import { users, services, appointments } from '../db/schema.js';

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
      const message = `🎉 *New Booking!*\n\n` +
        `👤 Client: ${clientName}\n` +
        `💇‍♀️ Service: ${serviceTitle}\n` +
        `📅 Date: ${date.toLocaleDateString()}\n` +
        `⏰ Time: ${time}`;

      await bot.telegram.sendMessage(masterTelegramId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Failed to send notification to master:', error);
    }
  },

  async notifyBookingConfirmation(
    clientTelegramId: string,
    serviceTitle: string,
    date: Date,
    time: string
  ) {
    if (!bot) return;

    try {
        const message = `✅ *Booking Confirmed!*\n\n` +
          `You are booked for *${serviceTitle}*.\n` +
          `📅 ${date.toLocaleDateString()} at ${time}\n\n` +
          `See you soon!`;
  
        await bot.telegram.sendMessage(clientTelegramId, message, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error('Failed to send confirmation to client:', error);
      }
  }
};

