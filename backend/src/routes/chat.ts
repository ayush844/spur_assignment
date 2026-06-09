import { Router, type Request, type Response } from 'express';
import {
  processMessage,
  getSessionHistory,
  validateMessage,
  ChatServiceError,
} from '../services/chat.js';

export const chatRouter = Router();

chatRouter.post('/message', async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body ?? {};

    const validation = validateMessage(message);
    if (!validation.valid) {
      res.status(400).json({ error: validation.error });
      return;
    }

    const result = await processMessage(validation.text!, sessionId);
    res.json(result);
  } catch (err) {
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
    const sessionId = req.params.sessionId as string;
    const history = await getSessionHistory(sessionId);
    res.json(history);
  } catch (err) {
    if (err instanceof ChatServiceError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('GET /chat/session error:', err);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
});
