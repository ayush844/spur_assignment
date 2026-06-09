import OpenAI from 'openai';
import { config } from '../config.js';
import { STORE_KNOWLEDGE } from '../knowledge/store.js';
import type { Message } from '../db/repository.js';

const SYSTEM_PROMPT = `${STORE_KNOWLEDGE}

Instructions:
- Answer clearly and concisely in a friendly, professional tone.
- Only answer questions related to Cozy Threads and customer support.
- If you don't know something or it's outside store scope, say so honestly and offer to connect the customer with a human agent during support hours.
- Never make up policies not listed above.
- Keep responses under 3 short paragraphs unless more detail is needed.`;

export class LlmError extends Error {
  constructor(
    message: string,
    public readonly userMessage: string
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

function getClient(): OpenAI {
  if (!config.openaiApiKey) {
    throw new LlmError(
      'OPENAI_API_KEY is not configured',
      'Our support agent is temporarily unavailable. Please try again later or email support@cozythreads.example.com.'
    );
  }
  return new OpenAI({ apiKey: config.openaiApiKey });
}

export async function generateReply(
  history: Message[],
  userMessage: string
): Promise<string> {
  const client = getClient();

  const recentHistory = history.slice(-config.maxHistoryMessages);
  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...recentHistory.map((msg) => ({
      role: msg.sender === 'user' ? ('user' as const) : ('assistant' as const),
      content: msg.text,
    })),
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await client.chat.completions.create({
      model: config.openaiModel,
      messages: chatMessages,
      max_tokens: config.maxTokens,
      temperature: 0.7,
    });

    const reply = response.choices[0]?.message?.content?.trim();
    if (!reply) {
      throw new LlmError('Empty LLM response', 'I had trouble generating a response. Could you rephrase your question?');
    }
    return reply;
  } catch (err) {
    if (err instanceof LlmError) throw err;

    const error = err as { status?: number; code?: string; message?: string };

    if (error.status === 401) {
      throw new LlmError('Invalid API key', 'Our support agent is temporarily unavailable. Please try again later.');
    }
    if (error.status === 429) {
      throw new LlmError('Rate limited', 'We\'re experiencing high demand. Please wait a moment and try again.');
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      throw new LlmError('Timeout', 'The request took too long. Please try again.');
    }

    console.error('LLM error:', err);
    throw new LlmError(
      error.message ?? 'Unknown LLM error',
      'Something went wrong on our end. Please try again in a moment.'
    );
  }
}
