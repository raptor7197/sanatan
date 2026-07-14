import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  consultationIdParamSchema,
  sendMessageSchema,
  listMessagesQuerySchema,
} from './messages.schemas.js';
import { sendHandler, listHandler } from './messages.controller.js';

export const messagesRouter = Router();

messagesRouter.use(authenticate);

messagesRouter.post(
  '/:id/messages',
  validate({ params: consultationIdParamSchema, body: sendMessageSchema }),
  sendHandler,
);
messagesRouter.get(
  '/:id/messages',
  validate({ params: consultationIdParamSchema, query: listMessagesQuerySchema }),
  listHandler,
);
