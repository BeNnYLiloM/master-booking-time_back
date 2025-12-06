import crypto from 'crypto';

interface UserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export function validateTelegramData(initData: string, botToken: string): UserData | null {
  if (!initData) return null;

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');

  if (!hash) return null;

  urlParams.delete('hash');

  const dataCheckString = Array.from(urlParams.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash === hash) {
    const userStr = urlParams.get('user');
    if (userStr) {
      try {
        return JSON.parse(userStr) as UserData;
      } catch (e) {
        console.error('Error parsing user data:', e);
        return null;
      }
    }
  }

  return null;
}

