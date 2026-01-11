# Деплой на Koyeb

## Шаги для деплоя:

### 1. Подготовка репозитория
- Закоммитьте все изменения в Git
- Запушьте в GitHub (если еще не сделали)

### 2. Создание приложения на Koyeb

1. Зарегистрируйтесь на https://koyeb.com
2. Создайте новый сервис → "Deploy from GitHub"
3. Подключите ваш GitHub репозиторий
4. Выберите папку `server` как Build Path (или корень, если репо только для сервера)

### 3. Настройки сборки

**Build Configuration:**
- Builder: Docker
- Dockerfile: `Dockerfile`
- Build context: `.` (текущая директория)

**Instance Configuration:**
- Region: ближайший к вашим пользователям (Frankfurt для RU)
- Instance type: Free (Nano)

### 4. Переменные окружения

Добавьте в Koyeb следующие переменные:

```
DATABASE_URL=your_neon_database_url
BOT_TOKEN=your_telegram_bot_token
WEB_APP_URL=your_vercel_frontend_url
JWT_SECRET=your_jwt_secret
NODE_ENV=production

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Yandex Maps (если используется)
YANDEX_MAPS_API_KEY=your_yandex_key

# Sentry (опционально)
SENTRY_DSN=your_sentry_dsn
```

### 5. Health Check

Koyeb автоматически использует endpoint `/health` для проверки состояния сервиса.

### 6. После деплоя

1. Скопируйте URL вашего сервиса (например: `https://your-app-name.koyeb.app`)
2. Обновите `WEB_APP_URL` на фронтенде (Vercel) на этот URL
3. Обновите Webhook URL для Telegram бота (если используется)

## Миграции БД

Миграции нужно запустить вручную один раз:

```bash
# Локально, указав DATABASE_URL из Neon
npm run db:migrate
```

Или создайте отдельный скрипт для миграций перед деплоем.

## Мониторинг

- Логи: Koyeb Dashboard → Your Service → Logs
- Метрики: Dashboard → Metrics
- Health: `/health` endpoint

## Проблемы и решения

### Холодный старт
Koyeb бесплатный план НЕ засыпает, но первый запрос может быть медленнее.

### База данных Neon
Neon может засыпать на бесплатном плане. Используйте `/health` для пробуждения.

### CORS ошибки
Убедитесь, что `WEB_APP_URL` правильно настроен в переменных окружения.
