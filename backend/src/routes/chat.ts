import { Router, type Request, type Response } from 'express';
import { processMessage, getSessionHistory, ChatServiceError } from '../services/chat.js';
import { postMessageSchema, sessionIdParamSchema } from '../schemas/chat.js';
import { parseOrThrow, ValidationError } from '../schemas/parse.js';

export const chatRouter = Router();

chatRouter.post('/message', async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = parseOrThrow(postMessageSchema, req.body ?? {});
    const result = await processMessage(message, sessionId);
    res.json(result);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof ChatServiceError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('POST /chat/message error:', err);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
});

chatRouter.get('/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = parseOrThrow(sessionIdParamSchema, req.params);
    const history = await getSessionHistory(sessionId);
    res.json(history);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof ChatServiceError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('GET /chat/session error:', err);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
});
