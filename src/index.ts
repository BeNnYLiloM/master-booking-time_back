import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { setupExpressErrorHandler, requestDataIntegration } from '@sentry/node';
import authRoutes from './routes/authRoutes.js';
import masterRoutes from './routes/masterRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import { startBot } from './bot.js';
import { db } from './db/index.js';
import { sql } from 'drizzle-orm';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Инициализация Sentry (должна быть в самом начале)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      nodeProfilingIntegration(),
      requestDataIntegration(),
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

// Безопасность: защита HTTP заголовков
app.use(helmet());

// CORS: разрешаем запросы только с нашего фронтенда
app.use(cors({
  origin: process.env.WEB_APP_URL || '*',
  credentials: true,
}));

// Rate limiting: защита от DDoS и брутфорса
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // максимум 100 запросов с одного IP за 15 минут
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

app.use(express.json());

// Healthcheck endpoint для мониторинга
app.get('/health', async (req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch {
    res.status(503).json({ 
      status: 'error', 
      message: 'Database unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/master', masterRoutes);
app.use('/api', publicRoutes);
app.use('/api/appointments', appointmentRoutes);

app.get('/', (req, res) => {
  res.send('MasterBookBot API is running');
});

// Sentry ErrorHandler должен быть ПЕРЕД вашим обработчиком ошибок
setupExpressErrorHandler(app);

// Глобальный обработчик ошибок
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[ERROR] ${new Date().toISOString()}:`, err.message);
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  startBot();
});

