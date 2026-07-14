import { z } from 'zod';

export const consultationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const listMessagesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
