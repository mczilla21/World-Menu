import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: Number(process.env.PORT) || 3000,
  host: process.env.HOST || '0.0.0.0',
  dbPath: process.env.DB_PATH || path.join(__dirname, '..', 'data', 'restaurant.db'),
  uploadsDir: path.join(__dirname, '..', 'data', 'uploads'),
  clientDist: path.join(__dirname, '..', '..', 'client', 'dist'),
  isProd: process.env.NODE_ENV === 'production',
};
