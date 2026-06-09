import { isRedisAvailable, getRedis } from '../cache/redis.js';
import { config } from '../config.js';
import type { SessionHistory } from './chat.js';

function sessionKey(sessionId: string): string {
  return `session:${sessionId}:history`;
}

function faqKey(message: string): string {
  return `faq:${message.toLowerCase().trim()}`;
}

export async function getCachedSessionHistory(
  sessionId: string
): Promise<SessionHistory | null> {
  if (!isRedisAvailable()) return null;

  try {
    const raw = await getRedis().get(sessionKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as SessionHistory;
  } catch (err) {
    console.warn('Redis session cache read failed:', err);
    return null;
  }
}

export async function setCachedSessionHistory(
  sessionId: string,
  history: SessionHistory
): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    await getRedis().setex(
      sessionKey(sessionId),
      config.redisSessionTtlSeconds,
      JSON.stringify(history)
    );
  } catch (err) {
    console.warn('Redis session cache write failed:', err);
  }
}

export async function invalidateSessionCache(sessionId: string): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    await getRedis().del(sessionKey(sessionId));
  } catch (err) {
    console.warn('Redis session cache invalidation failed:', err);
  }
}

export async function getCachedFaqReply(message: string): Promise<string | null> {
  if (!isRedisAvailable()) return null;

  try {
    return await getRedis().get(faqKey(message));
  } catch (err) {
    console.warn('Redis FAQ cache read failed:', err);
    return null;
  }
}

export async function setCachedFaqReply(
  message: string,
  reply: string
): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    await getRedis().setex(faqKey(message), config.redisFaqTtlSeconds, reply);
  } catch (err) {
    console.warn('Redis FAQ cache write failed:', err);
  }
}
