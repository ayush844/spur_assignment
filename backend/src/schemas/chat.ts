import { z } from 'zod';
import { config } from '../config.js';

export const postMessageSchema = z.object({
  message: z
    .string({ message: 'Message must be a string.' })
    .trim()
    .min(1, 'Message cannot be empty.')
    .max(
      config.maxMessageLength,
      `Message is too long. Maximum ${config.maxMessageLength} characters allowed.`
    ),
  sessionId: z.string().uuid('Invalid session ID format.').optional(),
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format.'),
});

export type PostMessageInput = z.infer<typeof postMessageSchema>;
