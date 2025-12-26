-- Добавление поддержки местоположения

-- 1. Добавляем locationType в services
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'at_master';

-- 2. Добавляем locationType и address в appointments
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS location_type TEXT;

ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS address JSONB;

-- 3. Обновляем существующие услуги (устанавливаем дефолт)
UPDATE services 
SET location_type = 'at_master' 
WHERE location_type IS NULL;

-- Комментарии для понимания
COMMENT ON COLUMN services.location_type IS 'Где оказывается услуга: at_master, at_client, both';
COMMENT ON COLUMN appointments.location_type IS 'Где была оказана услуга: at_master, at_client';
COMMENT ON COLUMN appointments.address IS 'Адрес оказания услуги (если at_client): {text: string, coordinates: [lat, lng]}';

