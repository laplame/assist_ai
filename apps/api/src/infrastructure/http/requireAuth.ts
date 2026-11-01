import type { NextFunction, Request, Response } from 'express';
import type { AuthVerifier } from '../../application/ports/AuthVerifier';
import { DomainError } from '../../domain/errors/DomainError';

export function requireAuth(auth: AuthVerifier) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      next(new DomainError('Token requerido', 'UNAUTHENTICATED', 401));
      return;
    }

    try {
      req.user = await auth.verify(header.slice('Bearer '.length).trim());
      next();
    } catch {
      next(new DomainError('Token inválido', 'UNAUTHENTICATED', 401));
    }
  };
}
