import { validate as isValidUuid } from 'uuid';
import { config } from '../config.js';
import * as db from '../db/repository.js';
import {
  getCachedSessionHistory,
  setCachedSessionHistory,
  invalidateSessionCache,
  getCachedFaqReply,
  setCachedFaqReply,
} from './cache.js';
import { generateReply, LlmError } from './llm.js';

export interface ChatResponse {
  reply: string;
  sessionId: string;
  error?: boolean;
}

export interface SessionHistory {
  sessionId: string;
  messages: Array<{
    id: string;
    sender: 'user' | 'ai';
    text: string;
    timestamp: string;
  }>;
}

function toSessionHistory(sessionId: string, messages: db.Message[]): SessionHistory {
  return {
    sessionId,
    messages: messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      timestamp: m.createdAt.toISOString(),
    })),
  };
}

export function validateMessage(message: unknown): { valid: boolean; text?: string; error?: string } {
  if (typeof message !== 'string') {
    return { valid: false, error: 'Message must be a string.' };
  }

  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty.' };
  }

  if (trimmed.length > config.maxMessageLength) {
    return {
      valid: false,
      error: `Message is too long. Maximum ${config.maxMessageLength} characters allowed.`,
    };
  }

  return { valid: true, text: trimmed };
}

export async function processMessage(
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  let conversationId = sessionId;

  if (conversationId) {
    if (!isValidUuid(conversationId)) {
      throw new ChatServiceError('Invalid session ID format.', 400);
    }
    const conversation = await db.getConversation(conversationId);
    if (!conversation) {
      throw new ChatServiceError('Session not found.', 404);
    }
  } else {
    const conversation = await db.createConversation();
    conversationId = conversation.id;
  }

  const history = await db.getMessages(conversationId);
  await db.addMessage(conversationId, 'user', message);
  await invalidateSessionCache(conversationId);

  const isFirstMessage = history.length === 0;
  let reply: string;
  let hadError = false;

  try {
    if (isFirstMessage) {
      const cached = await getCachedFaqReply(message);
      if (cached) {
        reply = cached;
      } else {
        reply = await generateReply(history, message);
        await setCachedFaqReply(message, reply);
      }
    } else {
      reply = await generateReply(history, message);
    }

    await db.addMessage(conversationId, 'ai', reply);
  } catch (err) {
    hadError = true;
    reply =
      err instanceof LlmError
        ? err.userMessage
        : 'Something went wrong. Please try again.';

    await db.addMessage(conversationId, 'ai', reply);
  }

  const updatedMessages = await db.getMessages(conversationId);
  await setCachedSessionHistory(conversationId, toSessionHistory(conversationId, updatedMessages));

  return { reply, sessionId: conversationId, error: hadError || undefined };
}

export async function getSessionHistory(sessionId: string): Promise<SessionHistory> {
  if (!isValidUuid(sessionId)) {
    throw new ChatServiceError('Invalid session ID format.', 400);
  }

  const cached = await getCachedSessionHistory(sessionId);
  if (cached) return cached;

  const conversation = await db.getConversation(sessionId);
  if (!conversation) {
    throw new ChatServiceError('Session not found.', 404);
  }

  const messages = await db.getMessages(sessionId);
  const history = toSessionHistory(sessionId, messages);
  await setCachedSessionHistory(sessionId, history);
  return history;
}

export class ChatServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'ChatServiceError';
  }
}
