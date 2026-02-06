import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import { appointmentService } from './services/appointmentService.js';
import { notificationService } from './services/notificationService.js';
import { db } from './db/index.js';
import { users } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { authService } from './services/authService.js';

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
        '• Для записи — попросите мастера прислать вам ссылку\n' +
        '• Хотите стать мастером? Напишите /make\\_master',
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            Markup.button.webApp('📱 Открыть приложение', webAppUrl)
          ])
        }
      );
    });

    // Команда /make_master — заявка на становление мастером
    bot.command('make_master', async (ctx) => {
      const telegramId = ctx.from.id.toString();
      const adminId = process.env.ADMIN_TELEGRAM_ID;
      
      if (!adminId) {
        return ctx.reply('⚠️ Регистрация мастеров временно недоступна. Обратитесь к администратору.');
      }

      // Проверяем, есть ли пользователь в БД и его роль
      let user = await db.query.users.findFirst({
        where: eq(users.telegramId, telegramId)
      });

      // Если пользователя нет — создаём
      if (!user) {
        const [newUser] = await db.insert(users)
          .values({
            telegramId: telegramId,
            firstName: ctx.from.first_name,
            username: ctx.from.username,
            role: 'client'
          })
          .returning();
        user = newUser;
      }

      // Если уже мастер
      if (user.role === 'master') {
        return ctx.reply(
          '✅ Вы уже зарегистрированы как мастер!\n\n' +
          'Откройте приложение для настройки профиля.',
          Markup.inlineKeyboard([
            Markup.button.webApp('📱 Открыть приложение', process.env.WEB_APP_URL || '')
          ])
        );
      }

      // Отправляем заявку админу
      try {
        const userName = ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '');
        const userLink = ctx.from.username ? `@${ctx.from.username}` : `ID: ${ctx.from.id}`;
        
        await bot.telegram.sendMessage(
          adminId,
          `📝 *Заявка на регистрацию мастера*\n\n` +
          `👤 Имя: ${userName}\n` +
          `🔗 ${userLink}\n` +
          `🆔 Telegram ID: \`${ctx.from.id}\``,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              Markup.button.callback('✅ Одобрить', `approve_master_${ctx.from.id}`),
              Markup.button.callback('❌ Отклонить', `decline_master_${ctx.from.id}`)
            ])
          }
        );

        return ctx.reply(
          '📨 *Заявка отправлена!*\n\n' +
          'Администратор рассмотрит вашу заявку и вы получите уведомление.',
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error('Failed to send master request to admin:', error);
        return ctx.reply('⚠️ Не удалось отправить заявку. Попробуйте позже.');
      }
    });

    // Обработка одобрения заявки мастера админом
    bot.action(/^approve_master_(\d+)$/, async (ctx) => {
      const targetTelegramId = ctx.match[1];
      const adminId = process.env.ADMIN_TELEGRAM_ID;
      
      // Проверяем что это админ
      if (ctx.from?.id.toString() !== adminId) {
        return ctx.answerCbQuery('❌ Только админ может одобрять заявки');
      }

      try {
        // Обновляем роль пользователя
        await db.update(users)
          .set({ role: 'master' })
          .where(eq(users.telegramId, targetTelegramId));

        // Уведомляем пользователя
        await bot.telegram.sendMessage(
          targetTelegramId,
          '🎉 *Поздравляем! Вы стали мастером!*\n\n' +
          'Теперь вы можете:\n' +
          '• Настроить свой профиль и услуги\n' +
          '• Получить ссылку для клиентов\n' +
          '• Принимать записи\n\n' +
          'Откройте приложение для начала работы!',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              Markup.button.webApp('📱 Открыть приложение', process.env.WEB_APP_URL || '')
            ])
          }
        );

        // Обновляем сообщение админу
        await ctx.editMessageText(
          ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message 
            ? ctx.callbackQuery.message.text + '\n\n✅ *Одобрено*'
            : '✅ Заявка одобрена',
          { parse_mode: 'Markdown' }
        );

        return ctx.answerCbQuery('✅ Мастер добавлен!');
      } catch (error) {
        console.error('Approve master error:', error);
        return ctx.answerCbQuery('Ошибка при одобрении');
      }
    });

    // Обработка отклонения заявки мастера
    bot.action(/^decline_master_(\d+)$/, async (ctx) => {
      const targetTelegramId = ctx.match[1];
      const adminId = process.env.ADMIN_TELEGRAM_ID;
      
      // Проверяем что это админ
      if (ctx.from?.id.toString() !== adminId) {
        return ctx.answerCbQuery('❌ Только админ может отклонять заявки');
      }

      try {
        // Уведомляем пользователя
        await bot.telegram.sendMessage(
          targetTelegramId,
          '😔 *Заявка отклонена*\n\n' +
          'К сожалению, ваша заявка на регистрацию мастера была отклонена.\n\n' +
          'Если у вас есть вопросы, свяжитесь с администратором.',
          { parse_mode: 'Markdown' }
        );

        // Обновляем сообщение админу
        await ctx.editMessageText(
          ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message 
            ? ctx.callbackQuery.message.text + '\n\n❌ *Отклонено*'
            : '❌ Заявка отклонена',
          { parse_mode: 'Markdown' }
        );

        return ctx.answerCbQuery('❌ Заявка отклонена');
      } catch (error) {
        console.error('Decline master error:', error);
        return ctx.answerCbQuery('Ошибка при отклонении');
      }
    });

    // Команда для мастера - получить ссылку для клиентов
    bot.command('mylink', async (ctx) => {
      const telegramId = ctx.from.id.toString();
      const botUsername = ctx.botInfo?.username;
      
      // Получаем пользователя из БД
      const user = await db.query.users.findFirst({
        where: eq(users.telegramId, telegramId)
      });

      if (!user || user.role !== 'master') {
        return ctx.reply(
          '⚠️ Эта команда доступна только мастерам.\n\n' +
          'Хотите стать мастером? Напишите /make\\_master',
          { parse_mode: 'Markdown' }
        );
      }

      const bookingLink = `https://t.me/${botUsername}?startapp=book_${user.id}`;
      
      ctx.reply(
        '🔗 *Ваша ссылка для клиентов:*\n\n' +
        `\`${bookingLink}\`\n\n` +
        'Отправьте эту ссылку клиентам для записи к вам.',
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

    // Клиент подтверждает завершение услуги
    bot.action(/^complete_confirm_(\d+)$/, async (ctx) => {
      const appointmentId = parseInt(ctx.match[1]);
      const telegramId = ctx.from?.id.toString();
      
      if (!telegramId) {
        return ctx.answerCbQuery('Ошибка авторизации');
      }

      try {
        // Находим клиента по telegramId
        const client = await db.query.users.findFirst({
          where: eq(users.telegramId, telegramId)
        });

        if (!client) {
          return ctx.answerCbQuery('Пользователь не найден');
        }

        // Получаем данные до подтверждения
        const fullAppointment = await appointmentService.getAppointmentById(appointmentId);

        // Подтверждаем завершение
        await appointmentService.confirmCompletion(appointmentId, client.id);
        
        if (fullAppointment && fullAppointment.master && fullAppointment.service) {
          const time = new Date(fullAppointment.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          
          // Уведомляем мастера
          await notificationService.notifyCompletionConfirmed(
            fullAppointment.master.telegramId,
            client.firstName || 'Клиент',
            fullAppointment.service.title,
            new Date(fullAppointment.startTime),
            time
          );
        }

        // Обновляем сообщение клиенту с кнопкой для отзыва
        const webAppUrl = process.env.WEB_APP_URL;
        // Используем прямую ссылку на страницу отзыва через WebApp (как для записи)
        const reviewUrl = `${webAppUrl}/client/review?appointment_id=${appointmentId}`;
        
        await ctx.editMessageText(
          (ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message 
            ? ctx.callbackQuery.message.text 
            : '🎉 Услуга оказана!') + '\n\n✅ *Вы подтвердили выполнение услуги. Спасибо!*\n\n' +
            '⭐️ Не забудьте оставить отзыв о работе мастера!',
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              Markup.button.webApp('⭐️ Оставить отзыв', reviewUrl)
            ])
          }
        );
        
        return ctx.answerCbQuery('✅ Спасибо за подтверждение!');
      } catch (error: any) {
        console.error('Complete confirm error:', error);
        return ctx.answerCbQuery(error.message || 'Ошибка подтверждения');
      }
    });

    // Клиент оспаривает завершение услуги
    bot.action(/^complete_dispute_(\d+)$/, async (ctx) => {
      const appointmentId = parseInt(ctx.match[1]);
      const telegramId = ctx.from?.id.toString();
      
      if (!telegramId) {
        return ctx.answerCbQuery('Ошибка авторизации');
      }

      try {
        // Находим клиента по telegramId
        const client = await db.query.users.findFirst({
          where: eq(users.telegramId, telegramId)
        });

        if (!client) {
          return ctx.answerCbQuery('Пользователь не найден');
        }

        // Получаем данные до оспаривания
        const fullAppointment = await appointmentService.getAppointmentById(appointmentId);

        // Оспариваем завершение
        await appointmentService.disputeCompletion(appointmentId, client.id);
        
        if (fullAppointment && fullAppointment.master && fullAppointment.service) {
          const time = new Date(fullAppointment.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          
          // Уведомляем мастера
          await notificationService.notifyCompletionDisputed(
            fullAppointment.master.telegramId,
            client.firstName || 'Клиент',
            fullAppointment.service.title,
            new Date(fullAppointment.startTime),
            time
          );
        }

        // Обновляем сообщение клиенту
        await ctx.editMessageText(
          ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message 
            ? ctx.callbackQuery.message.text + '\n\n⚠️ *Вы оспорили завершение. Мастер получил уведомление.*'
            : '⚠️ Завершение оспорено',
          { parse_mode: 'Markdown' }
        );
        
        return ctx.answerCbQuery('⚠️ Мастер уведомлён');
      } catch (error: any) {
        console.error('Complete dispute error:', error);
        return ctx.answerCbQuery(error.message || 'Ошибка');
      }
    });

    bot.launch().then(() => {
      console.log('✅ Telegram Bot launched');
      console.log(`📱 WEB_APP_URL: ${process.env.WEB_APP_URL || 'NOT SET'}`);
    }).catch((err) => {
      console.error('❌ Failed to launch Telegram Bot', err);
      Sentry.captureException(err);
    });

    // Глобальный обработчик ошибок бота
    bot.catch((err, ctx) => {
      console.error(`❌ Bot error for ${ctx.updateType}:`, err);
      Sentry.captureException(err, {
        contexts: {
          telegram: {
            update_type: ctx.updateType,
            user_id: ctx.from?.id,
            chat_id: ctx.chat?.id,
          },
        },
      });
    });

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  }
}

