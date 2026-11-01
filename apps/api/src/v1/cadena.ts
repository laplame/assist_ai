import type { CuerpoChecada } from '@bizne/integridad';
import { hashDeCadena } from '@bizne/integridad';

export interface ChecadaEntrante extends CuerpoChecada {
  hashPrev: string;
  hashActual: string;
  salt: string;
  hojaMerkle: string;
  deviceId: string;
}

export function evaluarChecada(
  anterior: { seq: number; hashActual: string } | null,
  entrada: ChecadaEntrante,
): { estado: 'ok' | 'rechazada'; motivo?: string } {
  const hashEsperado = hashDeCadena(entrada.hashPrev, {
    id: entrada.id,
    seq: entrada.seq,
    empleadoId: entrada.empleadoId,
    tipo: entrada.tipo,
    tsDispositivo: entrada.tsDispositivo,
    offsetAplicado: entrada.offsetAplicado,
    fotoSha256: entrada.fotoSha256,
    metodoIdentificacion: entrada.metodoIdentificacion,
    huellaOsConfirmada: entrada.huellaOsConfirmada,
  });
  if (hashEsperado !== entrada.hashActual) return { estado: 'rechazada', motivo: 'HASH' };
  if (!anterior) {
    if (entrada.seq !== 1 || entrada.hashPrev !== 'GENESIS') return { estado: 'rechazada', motivo: 'HUECO_SEQ' };
    return { estado: 'ok' };
  }
  if (entrada.seq !== anterior.seq + 1) return { estado: 'rechazada', motivo: 'HUECO_SEQ' };
  if (entrada.hashPrev !== anterior.hashActual) return { estado: 'rechazada', motivo: 'RUPTURA' };
  return { estado: 'ok' };
}
