import { Redis } from 'ioredis';
import { config } from '../config.js';

let client: Redis | null = null;
let available = false;

export function isRedisAvailable(): boolean {
  return available;
}

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });
  }
  return client;
}

export async function connectRedis(): Promise<boolean> {
  try {
    const redis = getRedis();
    await redis.connect();
    await redis.ping();
    available = true;
    return true;
  } catch (err) {
    available = false;
    console.warn('Redis unavailable — caching disabled:', (err as Error).message);
    return false;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
  available = false;
}
