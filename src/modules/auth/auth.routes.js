import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/auth.js';
import { registerSchema, loginSchema } from './auth.schemas.js';
import { registerHandler, loginHandler, profileHandler } from './auth.controller.js';

export const authRouter = Router();

// ponytail: skip limiter entirely in test env so the integration suite isn't rate-limited by itself.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

authRouter.use(authLimiter);

authRouter.post('/register', validate({ body: registerSchema }), registerHandler);
authRouter.post('/login', validate({ body: loginSchema }), loginHandler);

export const profileRouter = Router();
profileRouter.get('/', authenticate, profileHandler);
