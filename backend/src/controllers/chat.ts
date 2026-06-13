import type { Request, Response } from 'express';
import { processMessage, getSessionHistory } from '../services/chat.js';
import { postMessageSchema, sessionIdParamSchema } from '../schemas/chat.js';
import { parseOrThrow } from '../schemas/parse.js';

export async function postMessage(req: Request, res: Response): Promise<void> {
  const { message, sessionId } = parseOrThrow(postMessageSchema, req.body ?? {});
  const result = await processMessage(message, sessionId);
  res.json(result);
}

export async function getSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = parseOrThrow(sessionIdParamSchema, req.params);
  const history = await getSessionHistory(sessionId);
  res.json(history);
}
