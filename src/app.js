import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { prisma } from './config/prisma.js';
import { authRouter, profileRouter } from './modules/auth/auth.routes.js';
import { doctorsRouter } from './modules/doctors/doctors.routes.js';
import { consultationsRouter } from './modules/consultations/consultations.routes.js';
import { messagesRouter } from './modules/messages/messages.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const app = express();

app.use(helmet());
app.use(cors());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));
app.use(express.json());

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
app.use(express.static(publicDir));

app.get('/health', async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ data: { status: 'ok' } });
});

app.use('/auth', authRouter);
app.use('/profile', profileRouter);
app.use('/doctors', doctorsRouter);
app.use('/consultations', consultationsRouter);
app.use('/consultations', messagesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

// Vercel's zero-config Express detection requires a default export.
export default app;
