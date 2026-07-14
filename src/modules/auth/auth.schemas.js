import { z } from 'zod';

const email = z
  .string()
  .email()
  .transform((s) => s.toLowerCase());

export const registerSchema = z
  .object({
    name: z.string().min(1).max(200),
    email,
    password: z.string().min(8).max(100),
    role: z.enum(['PATIENT', 'DOCTOR']),
    specialization: z.string().min(1).max(200).optional(),
    yearsOfExperience: z.coerce.number().int().min(0).max(80).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role !== 'DOCTOR') return;
    if (!data.specialization) {
      ctx.addIssue({ code: 'custom', path: ['specialization'], message: 'Required for doctors' });
    }
    if (data.yearsOfExperience === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['yearsOfExperience'],
        message: 'Required for doctors',
      });
    }
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1),
});
