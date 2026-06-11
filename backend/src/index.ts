import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { chatRouter } from './routes/chat.js';
import { chatRateLimiter } from './middleware/rateLimit.js';
import { connectDatabase } from './db/prisma.js';
import { connectRedis, isRedisAvailable } from './cache/redis.js';

const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '16kb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    redis: isRedisAvailable() ? 'connected' : 'unavailable',
  });
});

app.use('/chat', chatRateLimiter, chatRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

async function start() {
  try {
    await connectDatabase();
    console.log('Database connected');
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }

  const redisOk = await connectRedis();
  if (redisOk) {
    console.log('Redis connected');
  }

  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
}

start();
