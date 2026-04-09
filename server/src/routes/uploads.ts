import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

export function registerUploadRoutes(app: FastifyInstance) {
  // Upload image
  app.post('/api/uploads', async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file uploaded' });

    // Ensure uploads directory exists
    if (!fs.existsSync(config.uploadsDir)) {
      fs.mkdirSync(config.uploadsDir, { recursive: true });
    }

    const ext = path.extname(data.filename).toLowerCase() || '.jpg';
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
    if (!allowedExts.includes(ext)) {
      return reply.status(400).send({ error: `File type not allowed. Allowed types: ${allowedExts.join(', ')}` });
    }

    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = path.join(config.uploadsDir, safeName);

    const buf = await data.toBuffer();
    fs.writeFileSync(filePath, buf);

    return { filename: safeName, url: `/uploads/${safeName}` };
  });
}
