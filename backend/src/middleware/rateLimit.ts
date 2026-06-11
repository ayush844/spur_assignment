import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

export const chatRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  message: { error: 'Too many requests. Please try again later.' },
});
