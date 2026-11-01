import type { AuthenticatedUser } from '../../application/ports/AuthVerifier';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
