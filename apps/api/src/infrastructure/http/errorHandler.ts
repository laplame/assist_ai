import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { DomainError } from '../../domain/errors/DomainError';

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION',
        message: 'Revisa los datos enviados',
        details: error.flatten(),
      },
    });
    return;
  }

  if (error instanceof DomainError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }

  if (error instanceof SyntaxError) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'JSON inválido' } });
    return;
  }

  console.error(error);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Error interno' } });
}
