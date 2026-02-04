import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Настройка Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Хранилище для фото услуг
const serviceStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'masterbookbot/services',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }],
  } as any,
});

// Хранилище для аватаров мастеров
const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'masterbookbot/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 500, height: 500, crop: 'limit', quality: 'auto' }],
  } as any,
});

// Хранилище для изображений категорий
const categoryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'masterbookbot/categories',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, height: 600, crop: 'limit', quality: 'auto' }],
  } as any,
});

// Multer middleware для загрузки фото услуг
export const uploadServiceImage = multer({
  storage: serviceStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Multer middleware для загрузки аватаров
export const uploadAvatar = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Multer middleware для загрузки изображений категорий
export const uploadCategoryImage = multer({
  storage: categoryStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Функция для удаления изображения из Cloudinary
export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    // Извлекаем public_id из URL
    // Пример URL: https://res.cloudinary.com/cloud_name/image/upload/v123456/masterbookbot/services/file.jpg
    const parts = imageUrl.split('/');
    const uploadIndex = parts.indexOf('upload');
    
    if (uploadIndex !== -1 && uploadIndex + 2 < parts.length) {
      // Берем все части после 'upload/v123456/' или 'upload/'
      const publicIdParts = parts.slice(uploadIndex + 1);
      // Пропускаем версию если есть (начинается с 'v')
      const startIndex = publicIdParts[0].startsWith('v') ? 1 : 0;
      const publicId = publicIdParts.slice(startIndex).join('/').replace(/\.[^.]+$/, ''); // убираем расширение
      
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error('Error deleting image from Cloudinary:', error);
    // Не бросаем ошибку, чтобы не блокировать удаление записи из БД
  }
}

export { cloudinary };
