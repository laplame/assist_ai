export type TipoJornada = 'diurna' | 'nocturna' | 'mixta';
export interface ParametrosAnio {
    anio: number;
    jornadaOrdinariaSemanal: number;
    topeDoblesSemana: number;
    maxExtraPorDia: number;
    maxDiasConExtra: number;
    topeAbsolutoExtra: number;
}
export declare function parametrosAnio(anio: number): ParametrosAnio;
export declare function dividirHalfUp(numerador: number, denominador: number): number;
export declare function pesosACentavos(pesos: number): number;
export declare function valorHoraCentavos(salarioDiarioCentavos: number, tipo: TipoJornada): number;
export interface DiaTrabajado {
    horasMilesimas: number;
    jornadaDiariaMilesimas: number;
}
export interface ClasificacionExtra {
    doblesMilesimas: number;
    triplesMilesimas: number;
    diasConExtra: number;
    excedeHorasDia: boolean;
    excedeDiasConExtra: boolean;
    excedeTopeAbsoluto: boolean;
    excedeDoceHoras: boolean;
}
export declare function clasificarExtra(dias: DiaTrabajado[], parametros: ParametrosAnio): ClasificacionExtra;
export declare function pagoHorasCentavos(milesimas: number, valorHora: number, factor: 2 | 3): number;
export declare const TOPE_UMA_SEMANAL_2026_CENTAVOS = 58655;
export interface ExencionExtra {
    pagoDoblesCentavos: number;
    pagoTriplesCentavos: number;
    pagoTotalCentavos: number;
    exentoCentavos: number;
    gravadoCentavos: number;
}
export declare function exencionTiempoExtra(input: {
    doblesMilesimas: number;
    triplesMilesimas: number;
    valorHoraCentavos: number;
    topeSemanalCentavos: number;
    doblesExentables: boolean;
}): ExencionExtra;
export interface RangoIsr {
    limiteInferiorCentavos: number;
    limiteSuperiorCentavos: number;
    cuotaFijaCentavos: number;
    porcentajeSobreExcedente: number;
}
export declare function isrDeTarifa(baseCentavos: number, tabla: RangoIsr[] | null): {
    ok: true;
    isrCentavos: number;
} | {
    ok: false;
    code: 'PARAMETRO_FALTANTE';
};
export declare function integrarSbc(input: {
    pagoDoblesCentavos: number;
    pagoTriplesCentavos: number;
    excedeLimites: boolean;
}): {
    conservadorCentavos: number;
    alternoCentavos: number;
    diferenciaCentavos: number;
};
export type Semaforo = 'verde' | 'ambar' | 'rojo';
export declare function semaforoJornada(horasOrdinarias: number, tope: number): Semaforo;
