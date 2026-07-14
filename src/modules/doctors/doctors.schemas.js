import { z } from 'zod';

export const listDoctorsSchema = z.object({
  specialization: z.string().min(1).max(200).optional(),
});

export const doctorIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
