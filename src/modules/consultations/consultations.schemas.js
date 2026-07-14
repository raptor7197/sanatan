import { z } from 'zod';

export const createConsultationSchema = z.object({
  doctorId: z.coerce.number().int().positive(),
});

export const consultationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listConsultationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACTIVE', 'COMPLETED']),
});
