import { validate as isValidUuid } from 'uuid';
import { config } from '../config.js';
import * as db from '../db/index.js';
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

  try {
    const reply = await generateReply(history, message);
    await db.addMessage(conversationId, 'ai', reply);
    return { reply, sessionId: conversationId };
  } catch (err) {
    const userMessage =
      err instanceof LlmError
        ? err.userMessage
        : 'Something went wrong. Please try again.';

    await db.addMessage(conversationId, 'ai', userMessage);
    return { reply: userMessage, sessionId: conversationId, error: true };
  }
}

export async function getSessionHistory(sessionId: string): Promise<SessionHistory> {
  if (!isValidUuid(sessionId)) {
    throw new ChatServiceError('Invalid session ID format.', 400);
  }

  const conversation = await db.getConversation(sessionId);
  if (!conversation) {
    throw new ChatServiceError('Session not found.', 404);
  }

  const messages = await db.getMessages(sessionId);
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

export class ChatServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'ChatServiceError';
  }
}
