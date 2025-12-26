import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('🔄 Применение миграции...');
  
  try {
    // Читаем SQL файл
    const migrationPath = path.join(__dirname, '../../migrations/001_add_location_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Выполняем миграцию
    await db.execute(sql.raw(migrationSQL));
    
    console.log('✅ Миграция успешно применена!');
    console.log('📋 Добавлены поля:');
    console.log('   - services.location_type (at_master/at_client/both)');
    console.log('   - appointments.location_type (at_master/at_client)');
    console.log('   - appointments.address (JSONB)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка применения миграции:', error);
    process.exit(1);
  }
}

runMigration();

