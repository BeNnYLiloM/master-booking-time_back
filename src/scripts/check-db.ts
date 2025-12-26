import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

async function checkDB() {
  console.log('🔍 Проверка структуры БД...\n');
  
  try {
    // Проверяем колонки в services
    console.log('📋 Таблица services:');
    const servicesColumns = await db.execute(sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'services' 
      ORDER BY ordinal_position;
    `);
    console.table(servicesColumns.rows);
    
    console.log('\n📋 Таблица appointments:');
    const appointmentsColumns = await db.execute(sql`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'appointments' 
      ORDER BY ordinal_position;
    `);
    console.table(appointmentsColumns.rows);
    
    // Проверяем наличие нужных полей
    const hasServiceLocationType = servicesColumns.rows.some((row: any) => row.column_name === 'location_type');
    const hasAppointmentLocationType = appointmentsColumns.rows.some((row: any) => row.column_name === 'location_type');
    const hasAppointmentAddress = appointmentsColumns.rows.some((row: any) => row.column_name === 'address');
    
    console.log('\n✅ Проверка наличия новых полей:');
    console.log(`   services.location_type: ${hasServiceLocationType ? '✅ Есть' : '❌ Отсутствует'}`);
    console.log(`   appointments.location_type: ${hasAppointmentLocationType ? '✅ Есть' : '❌ Отсутствует'}`);
    console.log(`   appointments.address: ${hasAppointmentAddress ? '✅ Есть' : '❌ Отсутствует'}`);
    
    // Проверяем подключение к БД
    const dbInfo = await db.execute(sql`SELECT current_database(), current_user;`);
    console.log('\n🔗 Подключение к БД:');
    console.log(`   База данных: ${dbInfo.rows[0].current_database}`);
    console.log(`   Пользователь: ${dbInfo.rows[0].current_user}`);
    console.log(`   URL: ${process.env.DATABASE_URL?.split('@')[1] || 'скрыт'}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка проверки:', error);
    process.exit(1);
  }
}

checkDB();

