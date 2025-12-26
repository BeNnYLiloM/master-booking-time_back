import { Request, Response } from 'express';
import axios from 'axios';

const YANDEX_GEOCODER_API = 'https://geocode-maps.yandex.ru/1.x/';

export const geocodeController = {
  // Получение подсказок адресов через Geocoder API
  async suggest(req: Request, res: Response) {
    try {
      const { text } = req.query;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Параметр text обязателен' });
      }

      const apiKey = process.env.YANDEX_MAPS_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'YANDEX_MAPS_KEY не настроен' });
      }

      // Используем Geocoder API для поиска
      const response = await axios.get(YANDEX_GEOCODER_API, {
        params: {
          apikey: apiKey,
          geocode: text,
          format: 'json',
          results: 5,
          lang: 'ru_RU',
        },
      });

      // Преобразуем ответ Geocoder в формат подсказок
      const featureMembers = response.data.response.GeoObjectCollection.featureMember || [];
      const results = featureMembers.map((member: any) => {
        const geoObject = member.GeoObject;
        const metadata = geoObject.metaDataProperty.GeocoderMetaData;
        
        return {
          title: {
            text: metadata.text, // Полный адрес
          },
          subtitle: {
            text: metadata.Address?.formatted || '', // Форматированный адрес
          },
          tags: [metadata.kind], // Тип объекта (locality, street, house и т.д.)
        };
      });

      return res.json({ results });
    } catch (error: any) {
      console.error('Yandex Geocoder API error:', error.message);
      return res.status(500).json({ 
        error: 'Ошибка получения подсказок',
        details: error.response?.data || error.message,
      });
    }
  },

  // Геокодирование (адрес → координаты)
  async geocode(req: Request, res: Response) {
    try {
      const { address } = req.query;
      
      if (!address || typeof address !== 'string') {
        return res.status(400).json({ error: 'Параметр address обязателен' });
      }

      const apiKey = process.env.YANDEX_MAPS_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'YANDEX_MAPS_KEY не настроен' });
      }

      const response = await axios.get(YANDEX_GEOCODER_API, {
        params: {
          apikey: apiKey,
          geocode: address,
          format: 'json',
          lang: 'ru_RU',
        },
      });

      const geoObject = response.data.response.GeoObjectCollection.featureMember[0];
      if (!geoObject) {
        return res.status(404).json({ error: 'Адрес не найден' });
      }

      const pos = geoObject.GeoObject.Point.pos.split(' '); // "lng lat"
      const coordinates = [parseFloat(pos[1]), parseFloat(pos[0])]; // [lat, lng]

      return res.json({
        address: geoObject.GeoObject.metaDataProperty.GeocoderMetaData.text,
        coordinates,
      });
    } catch (error: any) {
      console.error('Yandex Geocode API error:', error.message);
      return res.status(500).json({ 
        error: 'Ошибка геокодирования',
        details: error.response?.data || error.message,
      });
    }
  },

  // Обратное геокодирование (координаты → адрес)
  async reverseGeocode(req: Request, res: Response) {
    try {
      const { lat, lng } = req.query;
      
      if (!lat || !lng) {
        return res.status(400).json({ error: 'Параметры lat и lng обязательны' });
      }

      const apiKey = process.env.YANDEX_MAPS_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'YANDEX_MAPS_KEY не настроен' });
      }

      const response = await axios.get(YANDEX_GEOCODER_API, {
        params: {
          apikey: apiKey,
          geocode: `${lng},${lat}`, // Yandex принимает "lng,lat"
          format: 'json',
          lang: 'ru_RU',
        },
      });

      const geoObject = response.data.response.GeoObjectCollection.featureMember[0];
      if (!geoObject) {
        return res.status(404).json({ error: 'Адрес не найден' });
      }

      const address = geoObject.GeoObject.metaDataProperty.GeocoderMetaData.text;

      return res.json({ address });
    } catch (error: any) {
      console.error('Yandex Reverse Geocode API error:', error.message);
      return res.status(500).json({ 
        error: 'Ошибка обратного геокодирования',
        details: error.response?.data || error.message,
      });
    }
  },
};

