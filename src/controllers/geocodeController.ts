import { Request, Response } from 'express';
import axios from 'axios';

const YANDEX_GEOCODER_API = 'https://geocode-maps.yandex.ru/1.x/';
const YANDEX_SUGGEST_API = 'https://suggest-maps.yandex.ru/v1/suggest';

export const geocodeController = {
  // Получение подсказок адресов
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

      const response = await axios.get(YANDEX_SUGGEST_API, {
        params: {
          apikey: apiKey,
          text: text,
          results: 5,
          lang: 'ru_RU',
        },
      });

      return res.json(response.data);
    } catch (error: any) {
      console.error('Yandex Suggest API error:', error.message);
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

