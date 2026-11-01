import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import type { Container } from '../../composition/container';
import { v1Router } from '../../v1/routes';
import { apiRouter } from './routes';
import { errorHandler } from './errorHandler';

export function createApp(container: Container | null, origins: string[]) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: origins,
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'assist-api' });
  });

  if (container) app.use('/api', apiRouter(container));
  app.use('/api/v1', v1Router);

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
  });

  app.use(errorHandler);
  return app;
}
