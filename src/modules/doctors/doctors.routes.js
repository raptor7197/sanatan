import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { listDoctorsSchema, doctorIdParamSchema } from './doctors.schemas.js';
import { listHandler, getHandler } from './doctors.controller.js';

export const doctorsRouter = Router();

doctorsRouter.use(authenticate);
doctorsRouter.get('/', validate({ query: listDoctorsSchema }), listHandler);
doctorsRouter.get('/:id', validate({ params: doctorIdParamSchema }), getHandler);
