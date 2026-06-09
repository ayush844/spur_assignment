import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/spur_chat',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6380',
  redisSessionTtlSeconds: parseInt(process.env.REDIS_SESSION_TTL_SECONDS ?? '3600', 10),
  redisFaqTtlSeconds: parseInt(process.env.REDIS_FAQ_TTL_SECONDS ?? '86400', 10),
  openaiApiKey: process.env.OPENAI_API_KEY ?? '',
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  maxMessageLength: parseInt(process.env.MAX_MESSAGE_LENGTH ?? '4000', 10),
  maxHistoryMessages: parseInt(process.env.MAX_HISTORY_MESSAGES ?? '20', 10),
  maxTokens: parseInt(process.env.MAX_TOKENS ?? '500', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};
