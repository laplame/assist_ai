export { sha256Hex, utf8 } from './sha256';
export declare function canonicalJson(value: unknown): string;
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
export declare function hashPin(salt: string, pin: string): string;
export declare function hashDeCadena(hashPrevio: string, cuerpo: CuerpoChecada): string;
export declare function hojaMerkle(hoja: HojaChecada): string;
export declare const NODO_VACIO: string;
export declare function hashNodo(izquierda: string, derecha: string): string;
export interface PasoPrueba {
    lado: 'izq' | 'der';
    hash: string;
}
export declare function armarArbol(hojas: string[]): {
    raiz: string;
    pruebas: PasoPrueba[][];
};
export declare function verificarPrueba(hoja: string, prueba: PasoPrueba[], raiz: string): boolean;
export type TipoChecada = 'entrada' | 'comida_inicio' | 'comida_fin' | 'salida' | 'pausa_inicio' | 'pausa_fin' | 'correccion';
export declare function inferirTipo(ultimo: TipoChecada | null): TipoChecada;
export declare function esRebote(ultimaMs: number | null, ahoraMs: number): boolean;
export declare function distanciaMetros(aLat: number, aLng: number, bLat: number, bLng: number): number;
