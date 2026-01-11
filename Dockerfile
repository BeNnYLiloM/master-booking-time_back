# Используем официальный Node.js образ
FROM node:20-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем зависимости (только production)
RUN npm ci --only=production

# Копируем остальные файлы
COPY . .

# Билдим TypeScript
RUN npm run build

# Экспонируем порт (Koyeb автоматически определит)
EXPOSE 3000

# Запускаем сервер
CMD ["npm", "start"]
