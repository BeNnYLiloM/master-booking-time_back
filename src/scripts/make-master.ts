// Скрипт для превращения пользователя в мастера
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config();

const telegramId = process.argv[2];

if (!telegramId) {
  console.log('Usage: npm run make-master <telegram_id>');
  console.log('Example: npm run make-master 123456789');
  console.log('\nЧтобы узнать свой Telegram ID:');
  console.log('1. Откройте @userinfobot в Telegram');
  console.log('2. Отправьте любое сообщение');
  console.log('3. Бот покажет ваш ID');
  process.exit(1);
}

async function makeMaster() {
  console.log(`🔧 Making user ${telegramId} a master...`);

  // Проверяем, существует ли пользователь
  const existingUser = await db.query.users.findFirst({
    where: eq(users.telegramId, telegramId),
  });

  if (!existingUser) {
    // Создаём нового мастера
    const [newUser] = await db.insert(users).values({
      telegramId: telegramId,
      role: 'master',
      firstName: 'Мастер',
      masterProfile: {
        displayName: 'Мой салон',
        description: 'Описание услуг',
        workStartHour: 10,
        workEndHour: 20,
        slotDuration: 60,
        daysOff: [0, 6]
      }
    }).returning();
    
    console.log('✅ New master created:', newUser);
  } else {
    // Обновляем существующего
    await db.update(users)
      .set({ 
        role: 'master',
        masterProfile: existingUser.masterProfile || {
          displayName: existingUser.firstName || 'Мастер',
          description: 'Описание услуг',
          workStartHour: 10,
          workEndHour: 20,
          slotDuration: 60,
          daysOff: [0, 6]
        }
      })
      .where(eq(users.telegramId, telegramId));
    
    console.log('✅ User updated to master:', telegramId);
  }

  // Показываем всех пользователей
  const allUsers = await db.query.users.findMany();
  console.log('\n📋 All users in database:');
  allUsers.forEach(u => {
    console.log(`  - ID: ${u.id}, TelegramID: ${u.telegramId}, Role: ${u.role}, Name: ${u.firstName}`);
  });

  process.exit(0);
}

makeMaster().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});

