import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

/**
 * Contrato del arranque del kiosko.
 * tenants ← un equipo nuevo abre el suyo.
 * sucursales ← la sucursal de alta y las que ya existan en ese tenant.
 * usuarios + membresias ← el admin y el resto del equipo. El PIN viaja como hash.
 * salarios_pactados ← sueldo diario en centavos y tipo de jornada.
 * dispositivos ← este teléfono, con token de un año.
 * checadas ← lote pendiente, misma cadena que /dispositivos/checadas/lote.
 */
export const PASSCODE_SINCRONIZACION = '1234';

export function passcodeSincronizacionValido(valor: string): boolean {
  const recibido = Buffer.from(valor);
  const esperado = Buffer.from(PASSCODE_SINCRONIZACION);
  if (recibido.length !== esperado.length) return false;
  return timingSafeEqual(recibido, esperado);
}

export const sucursalSyncSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(2),
  estado: z.string().min(2),
  municipio: z.string().min(2),
});

export const empleadoSyncSchema = z.object({
  id: z.string().min(1),
  nombre: z.string().min(2),
  pinHash: z.string().min(8),
  salt: z.string().min(4),
  rol: z.enum(['empleado', 'coach', 'admin', 'contador']).default('empleado'),
});

export const pactoSyncSchema = z.object({
  empleadoId: z.string().min(1),
  salarioDiarioCentavos: z.number().int().positive(),
  tipoJornada: z.enum(['diurna', 'nocturna', 'mixta']),
});

export const checadaSyncSchema = z.object({
  id: z.string().uuid(),
  seq: z.number().int().positive(),
  empleadoId: z.string(),
  tipo: z.string(),
  tsDispositivo: z.number(),
  offsetAplicado: z.number(),
  fotoSha256: z.string(),
  metodoIdentificacion: z.string(),
  huellaOsConfirmada: z.boolean(),
  hashPrev: z.string(),
  hashActual: z.string(),
  salt: z.string(),
  hojaMerkle: z.string(),
});

export const sincronizacionKioskoSchema = z.object({
  passcode: z.string().min(4),
  androidIdHash: z.string().min(8),
  modelo: z.string().min(1).default('android'),
  sucursal: sucursalSyncSchema,
  admin: empleadoSyncSchema,
  sucursales: z.array(sucursalSyncSchema).max(50).default([]),
  empleados: z.array(empleadoSyncSchema).max(300).default([]),
  pactos: z.array(pactoSyncSchema).max(300).default([]),
  checadas: z.array(checadaSyncSchema).max(20).default([]),
});

export type SincronizacionKiosko = z.infer<typeof sincronizacionKioskoSchema>;

export function horasDeJornada(tipo: 'diurna' | 'nocturna' | 'mixta'): number {
  if (tipo === 'nocturna') return 7;
  if (tipo === 'mixta') return 7.5;
  return 8;
}

export function tipoDeJornada(horas: number): 'diurna' | 'nocturna' | 'mixta' {
  if (horas === 7) return 'nocturna';
  if (horas === 7.5) return 'mixta';
  return 'diurna';
}
