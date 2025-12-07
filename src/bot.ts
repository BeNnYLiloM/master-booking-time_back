import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import { appointmentService } from './services/appointmentService.js';
import { notificationService } from './services/notificationService.js';
import { db } from './db/index.js';
import { users } from './db/schema.js';
import { eq } from 'drizzle-orm';

dotenv.config();

const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  console.warn('BOT_TOKEN is not set! Bot notifications will not work.');
}

export const bot = botToken ? new Telegraf(botToken) : null;

export function startBot() {
  if (bot) {
    // Команда /start - для всех пользователей
    bot.start(async (ctx) => {
      console.log(`Received /start from ${ctx.from.id}`);
      const webAppUrl = process.env.WEB_APP_URL;
      
      if (!webAppUrl) {
        return ctx.reply('⚠️ WEB_APP_URL не настроен. Обратитесь к администратору.');
      }

      // Проверяем start параметр (для записи по ссылке мастера)
      const startParam = ctx.message.text.split(' ')[1]; // /start book_1
      
      if (startParam && startParam.startsWith('book_')) {
        // Клиент перешёл по ссылке мастера
        const masterId = startParam.replace('book_', '');
        const bookingUrl = `${webAppUrl}/booking/${masterId}`;
        
        return ctx.reply(
          '📅 Запись к мастеру\n\nНажмите кнопку ниже, чтобы выбрать услугу и время:',
          Markup.inlineKeyboard([
            Markup.button.webApp('📝 Записаться', bookingUrl)
          ])
        );
      }

      // Обычный старт - показываем главное меню с inline кнопкой
      ctx.reply(
        '👋 Добро пожаловать в MasterBookBot!\n\n' +
        '🎯 Это приложение для записи к мастерам.\n\n' +
        '• Если вы **мастер** — откройте приложение и настройте свой профиль\n' +
        '• Если вы **клиент** — попросите мастера прислать вам ссылку для записи',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            Markup.button.webApp('📱 Открыть приложение', webAppUrl)
          ])
        }
      );
    });

    // Команда для мастера - получить ссылку для клиентов
    bot.command('mylink', async (ctx) => {
      const webAppUrl = process.env.WEB_APP_URL;
      const botUsername = ctx.botInfo?.username;
      
      // Тут нужно получить ID мастера из БД по telegramId
      // Пока упрощённо - показываем инструкцию
      ctx.reply(
        '🔗 Ваша ссылка для клиентов:\n\n' +
        `\`https://t.me/${botUsername}?startapp=book_YOUR_ID\`\n\n` +
        '_(Замените YOUR_ID на ваш ID из приложения)_\n\n' +
        'Откройте приложение, чтобы увидеть свою ссылку на Dashboard.',
        { parse_mode: 'Markdown' }
      );
    });

    // Обработка inline-кнопок подтверждения/отклонения записи
    bot.action(/^confirm_(\d+)$/, async (ctx) => {
      const appointmentId = parseInt(ctx.match[1]);
      const telegramId = ctx.from?.id.toString();
      
      if (!telegramId) {
        return ctx.answerCbQuery('Ошибка авторизации');
      }

      try {
        // Находим мастера по telegramId
        const master = await db.query.users.findFirst({
          where: eq(users.telegramId, telegramId)
        });

        if (!master) {
          return ctx.answerCbQuery('Мастер не найден');
        }

        // Подтверждаем запись
        const appointment = await appointmentService.confirmAppointment(appointmentId, master.id);
        
        // Получаем полные данные для уведомления
        const fullAppointment = await appointmentService.getAppointmentById(appointmentId);
        
        if (fullAppointment && fullAppointment.client && fullAppointment.service) {
          const masterProfile = master.masterProfile as { displayName?: string; description?: string } | null;
          const masterName = masterProfile?.displayName || master.firstName || 'Мастер';
          const masterDescription = masterProfile?.description || null;
          const time = new Date(fullAppointment.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          
          // Уведомляем клиента
          await notificationService.notifyBookingConfirmed(
            fullAppointment.client.telegramId,
            masterName,
            masterDescription,
            fullAppointment.service.title,
            new Date(fullAppointment.startTime),
            time
          );
        }

        // Обновляем сообщение мастеру
        await ctx.editMessageText(
          ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message 
            ? ctx.callbackQuery.message.text + '\n\n✅ *Запись подтверждена*'
            : '✅ Запись подтверждена',
          { parse_mode: 'Markdown' }
        );
        
        return ctx.answerCbQuery('✅ Запись подтверждена!');
      } catch (error: any) {
        console.error('Confirm error:', error);
        return ctx.answerCbQuery(error.message || 'Ошибка подтверждения');
      }
    });

    bot.action(/^reject_(\d+)$/, async (ctx) => {
      const appointmentId = parseInt(ctx.match[1]);
      const telegramId = ctx.from?.id.toString();
      
      if (!telegramId) {
        return ctx.answerCbQuery('Ошибка авторизации');
      }

      try {
        // Находим мастера по telegramId
        const master = await db.query.users.findFirst({
          where: eq(users.telegramId, telegramId)
        });

        if (!master) {
          return ctx.answerCbQuery('Мастер не найден');
        }

        // Получаем данные до отклонения
        const fullAppointment = await appointmentService.getAppointmentById(appointmentId);

        // Отклоняем запись
        await appointmentService.rejectAppointment(appointmentId, master.id);
        
        if (fullAppointment && fullAppointment.client && fullAppointment.service) {
          const masterProfile = master.masterProfile as { displayName?: string } | null;
          const masterName = masterProfile?.displayName || master.firstName || 'Мастер';
          const time = new Date(fullAppointment.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          
          // Уведомляем клиента об отклонении
          await notificationService.notifyBookingRejected(
            fullAppointment.client.telegramId,
            masterName,
            fullAppointment.service.title,
            new Date(fullAppointment.startTime),
            time
          );
        }

        // Обновляем сообщение мастеру
        await ctx.editMessageText(
          ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message 
            ? ctx.callbackQuery.message.text + '\n\n❌ *Запись отклонена*'
            : '❌ Запись отклонена',
          { parse_mode: 'Markdown' }
        );
        
        return ctx.answerCbQuery('❌ Запись отклонена');
      } catch (error: any) {
        console.error('Reject error:', error);
        return ctx.answerCbQuery(error.message || 'Ошибка отклонения');
      }
    });

    bot.launch().then(() => {
      console.log('✅ Telegram Bot launched');
      console.log(`📱 WEB_APP_URL: ${process.env.WEB_APP_URL || 'NOT SET'}`);
    }).catch((err) => {
      console.error('❌ Failed to launch Telegram Bot', err);
    });

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
}

