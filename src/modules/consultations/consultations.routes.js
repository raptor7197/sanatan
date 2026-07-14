import { Router } from 'express';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createConsultationSchema,
  consultationIdParamSchema,
  listConsultationsQuerySchema,
  updateStatusSchema,
} from './consultations.schemas.js';
import {
  createHandler,
  listHandler,
  getHandler,
  updateStatusHandler,
} from './consultations.controller.js';

export const consultationsRouter = Router();

consultationsRouter.use(authenticate);

consultationsRouter.post(
  '/',
  requireRole('PATIENT'),
  validate({ body: createConsultationSchema }),
  createHandler,
);
consultationsRouter.get('/', validate({ query: listConsultationsQuerySchema }), listHandler);
consultationsRouter.get('/:id', validate({ params: consultationIdParamSchema }), getHandler);
consultationsRouter.patch(
  '/:id/status',
  validate({ params: consultationIdParamSchema, body: updateStatusSchema }),
  updateStatusHandler,
);
