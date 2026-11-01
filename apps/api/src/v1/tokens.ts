import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError } from './errors';

export interface ClaimsUsuario {
  typ: 'usuario';
  sub: string;
  tenantId: string;
  membresiaId: string;
  rol: 'empleado' | 'coach' | 'admin' | 'contador';
}

export interface ClaimsSeleccion {
  typ: 'seleccion';
  sub: string;
}

export interface ClaimsDispositivo {
  typ: 'dispositivo';
  sub: string;
  tenantId: string;
  sucursalId: string;
  deviceId: string;
  rol: 'dispositivo';
}

export type Claims = ClaimsUsuario | ClaimsSeleccion | ClaimsDispositivo;

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new ApiError('Falta JWT_SECRET', 'CONFIG', 500);
  return value;
}

export function firmar(claims: Claims, expiraEnSegundos = 60 * 60 * 12): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + expiraEnSegundos })).toString('base64url');
  const firma = createHmac('sha256', secret()).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${firma}`;
}

export function leerToken(token: string): Claims & { exp: number } {
  const [header, body, firma] = token.split('.');
  if (!header || !body || !firma) throw new ApiError('Token inválido', 'TOKEN', 401);
  const esperada = createHmac('sha256', secret()).update(`${header}.${body}`).digest('base64url');
  const a = Buffer.from(firma);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError('Token inválido', 'TOKEN', 401);
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString()) as Claims & { exp: number };
  if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) throw new ApiError('Token vencido', 'TOKEN', 401);
  return claims;
}
