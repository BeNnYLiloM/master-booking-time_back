// ВАЖНО: Sentry должен быть импортирован ПЕРВЫМ
import './instrument.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import { setupExpressErrorHandler, requestDataIntegration } from '@sentry/node';
import authRoutes from './routes/authRoutes.js';
import masterRoutes from './routes/masterRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import testRoutes from './routes/testRoutes.js';
import geocodeRoutes from './routes/geocodeRoutes.js';
import { startBot } from './bot.js';
import { db } from './db/index.js';
import { sql } from 'drizzle-orm';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy: Railway, Heroku и другие PaaS используют прокси
// Это нужно для корректной работы rate limiter и получения реального IP
app.set('trust proxy', 1);

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
app.use('/api/geocode', geocodeRoutes); // Прокси для Yandex Maps
app.use('/api/test', testRoutes); // Тестовые endpoints

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

