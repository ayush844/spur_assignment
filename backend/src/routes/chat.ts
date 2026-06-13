import { Router } from 'express';
import { postMessage, getSession } from '../controllers/chat.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const chatRouter = Router();

chatRouter.post('/message', asyncHandler(postMessage));
chatRouter.get('/session/:sessionId', asyncHandler(getSession));
