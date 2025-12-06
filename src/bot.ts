import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';

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

      // Обычный старт - показываем главное меню
      ctx.reply(
        '👋 Добро пожаловать в MasterBookBot!\n\n' +
        '🎯 Это приложение для записи к мастерам.\n\n' +
        '• Если вы **мастер** — откройте приложение и настройте свой профиль\n' +
        '• Если вы **клиент** — попросите мастера прислать вам ссылку для записи',
        {
          parse_mode: 'Markdown',
          ...Markup.keyboard([
            [Markup.button.webApp('📱 Открыть приложение', webAppUrl)]
          ]).resize()
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

