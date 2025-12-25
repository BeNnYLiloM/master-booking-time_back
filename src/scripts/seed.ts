// Скрипт для создания тестового мастера
import { db } from '../db/index.js';
import { users, services } from '../db/schema.js';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('🌱 Seeding database...');

  // Создаём дефолтное расписание
  const defaultSchedule: any = {};
  for (let i = 0; i < 7; i++) {
    defaultSchedule[i] = {
      enabled: i >= 1 && i <= 5, // Пн-Пт включены
      start: '10:00',
      end: '20:00'
    };
  }

  // Создаём тестового мастера
  const [master] = await db.insert(users).values({
    telegramId: '123456789', // Тестовый ID
    role: 'master',
    firstName: 'Тестовый Мастер',
    username: 'test_master',
    masterProfile: {
      displayName: 'Анна Мастер',
      description: 'Профессиональный мастер маникюра',
      slotDuration: 60, // 1 час
      schedule: defaultSchedule
    }
  }).returning();

  console.log('✅ Master created:', master);

  // Создаём услуги для мастера
  const servicesData = [
    { masterId: master.id, title: 'Маникюр классический', price: 1500, duration: 60, currency: 'RUB' },
    { masterId: master.id, title: 'Маникюр с покрытием', price: 2500, duration: 90, currency: 'RUB' },
    { masterId: master.id, title: 'Педикюр', price: 2000, duration: 90, currency: 'RUB' },
  ];

  const createdServices = await db.insert(services).values(servicesData).returning();
  console.log('✅ Services created:', createdServices);

  console.log('\n🎉 Seed completed!');
  console.log(`\n📱 Для тестирования откройте: http://localhost:5173/booking/${master.id}`);
  
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

