import { Router } from 'express';
import { geocodeController } from '../controllers/geocodeController.js';

const router = Router();

// Получение подсказок адресов
router.get('/suggest', geocodeController.suggest);

// Геокодирование (адрес → координаты)
router.get('/geocode', geocodeController.geocode);

// Обратное геокодирование (координаты → адрес)
router.get('/reverse-geocode', geocodeController.reverseGeocode);

export default router;

