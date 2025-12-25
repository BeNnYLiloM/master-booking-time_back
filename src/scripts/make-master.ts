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
    // Создаём дефолтное расписание
    const defaultSchedule: any = {};
    for (let i = 0; i < 7; i++) {
      defaultSchedule[i] = {
        enabled: i >= 1 && i <= 5, // Пн-Пт включены
        start: '09:00',
        end: '18:00'
      };
    }
    
    // Создаём нового мастера
    const [newUser] = await db.insert(users).values({
      telegramId: telegramId,
      role: 'master',
      firstName: 'Мастер',
      masterProfile: {
        displayName: 'Мой салон',
        description: 'Описание услуг',
        slotDuration: 60,
        schedule: defaultSchedule
      }
    }).returning();
    
    console.log('✅ New master created:', newUser);
  } else {
    // Создаём дефолтное расписание если профиля нет
    const defaultSchedule: any = {};
    for (let i = 0; i < 7; i++) {
      defaultSchedule[i] = {
        enabled: i >= 1 && i <= 5,
        start: '09:00',
        end: '18:00'
      };
    }
    
    // Обновляем существующего
    await db.update(users)
      .set({ 
        role: 'master',
        masterProfile: existingUser.masterProfile || {
          displayName: existingUser.firstName || 'Мастер',
          description: 'Описание услуг',
          slotDuration: 60,
          schedule: defaultSchedule
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

