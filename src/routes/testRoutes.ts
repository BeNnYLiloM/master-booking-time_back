// Тестовый endpoint для проверки Sentry
import { Router } from 'express';
import * as Sentry from '@sentry/node';

const router = Router();

// Тест Sentry - бросает ошибку
router.get('/test-sentry', (req, res) => {
  console.log('🧪 Testing Sentry...');
  
  // Отправляем тестовое сообщение
  Sentry.captureMessage('Test message from API', 'info');
  
  // Бросаем тестовую ошибку
  throw new Error('🧪 Test Sentry Error - this is intentional!');
});

export default router;

