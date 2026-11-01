import { concatBytes, fromHex, sha256Hex, utf8 } from './sha256';

export { sha256Hex, utf8 } from './sha256';

export function canonicalJson(value: unknown): string {
  return JSON.stringify(ordenar(value));
}

function ordenar(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => ordenar(item));
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] !== undefined) out[key] = ordenar(source[key]);
    }
    return out;
  }
  return value;
}

export interface CuerpoChecada {
  id: string;
  seq: number;
  empleadoId: string;
  tipo: string;
  tsDispositivo: number;
  offsetAplicado: number;
  fotoSha256: string;
  metodoIdentificacion: string;
  huellaOsConfirmada: boolean;
}

export interface HojaChecada {
  empleadoRef: string;
  tipo: string;
  ts: number;
  dispositivoId: string;
  seq: number;
  hashFoto: string;
  salt: string;
}

export function hashPin(salt: string, pin: string): string {
  return sha256Hex(utf8(`${salt}:${pin}`));
}

export function hashDeCadena(hashPrevio: string, cuerpo: CuerpoChecada): string {
  return sha256Hex(utf8(hashPrevio + canonicalJson(cuerpo)));
}

export function hojaMerkle(hoja: HojaChecada): string {
  return sha256Hex(concatBytes([new Uint8Array([0x00]), utf8(canonicalJson(hoja))]));
}

export const NODO_VACIO = sha256Hex(new Uint8Array([0x02]));

export function hashNodo(izquierda: string, derecha: string): string {
  return sha256Hex(concatBytes([new Uint8Array([0x01]), fromHex(izquierda), fromHex(derecha)]));
}

export interface PasoPrueba {
  lado: 'izq' | 'der';
  hash: string;
}

export function armarArbol(hojas: string[]): { raiz: string; pruebas: PasoPrueba[][] } {
  if (hojas.length === 0) throw new Error('Un lote necesita al menos una hoja');
  const pruebas: PasoPrueba[][] = hojas.map(() => []);
  let nivel = hojas.map((hash, index) => ({ hash, hojas: [index] }));

  while (nivel.length > 1) {
    const siguiente: Array<{ hash: string; hojas: number[] }> = [];
    for (let i = 0; i < nivel.length; i += 2) {
      const izquierda = nivel[i];
      if (!izquierda) continue;
      const derecha = nivel[i + 1];
      const hashDerecha = derecha?.hash ?? NODO_VACIO;
      for (const hoja of izquierda.hojas) pruebas[hoja]?.push({ lado: 'der', hash: hashDerecha });
      for (const hoja of derecha?.hojas ?? []) pruebas[hoja]?.push({ lado: 'izq', hash: izquierda.hash });
      siguiente.push({
        hash: hashNodo(izquierda.hash, hashDerecha),
        hojas: [...izquierda.hojas, ...(derecha?.hojas ?? [])],
      });
    }
    nivel = siguiente;
  }

  return { raiz: nivel[0]?.hash ?? '', pruebas };
}

export function verificarPrueba(hoja: string, prueba: PasoPrueba[], raiz: string): boolean {
  let actual = hoja;
  for (const paso of prueba) {
    actual = paso.lado === 'der' ? hashNodo(actual, paso.hash) : hashNodo(paso.hash, actual);
  }
  return actual === raiz;
}

export type TipoChecada = 'entrada' | 'comida_inicio' | 'comida_fin' | 'salida' | 'pausa_inicio' | 'pausa_fin' | 'correccion';

export function inferirTipo(ultimo: TipoChecada | null): TipoChecada {
  if (ultimo === 'entrada') return 'comida_inicio';
  if (ultimo === 'comida_inicio') return 'comida_fin';
  if (ultimo === 'comida_fin') return 'salida';
  return 'entrada';
}

export function esRebote(ultimaMs: number | null, ahoraMs: number): boolean {
  return ultimaMs !== null && ahoraMs - ultimaMs < 60_000;
}

export function distanciaMetros(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
