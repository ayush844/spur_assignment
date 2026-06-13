import type { Request, Response, RequestHandler } from 'express';
import { ChatServiceError } from '../services/chat.js';
import { ValidationError } from '../schemas/parse.js';

export function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>
): RequestHandler {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      if (err instanceof ValidationError) {
        res.status(400).json({ error: err.message });
        return;
      }
      if (err instanceof ChatServiceError) {
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      console.error(`${req.method} ${req.path} error:`, err);
      res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
    }
  };
}
