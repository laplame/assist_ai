import { AsyncLocalStorage } from 'node:async_hooks';
import type { ClaimsUsuario } from './tokens';

export const tenantStorage = new AsyncLocalStorage<ClaimsUsuario>();

export function tenantActual(): ClaimsUsuario {
  const ctx = tenantStorage.getStore();
  if (!ctx) throw new Error('Repositorio fuera de contexto de tenant');
  return ctx;
}
