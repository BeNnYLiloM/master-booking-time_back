// Sentry Instrumentation (должен быть импортирован ПЕРВЫМ)
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import dotenv from 'dotenv';

// Загружаем .env
dotenv.config();

// Инициализация Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      nodeProfilingIntegration(),
    ],
    // Процент отслеживаемых транзакций
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Процент профилирования
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
  console.log('✅ Sentry initialized');
} else {
  console.warn('⚠️ SENTRY_DSN not found, Sentry disabled');
}

