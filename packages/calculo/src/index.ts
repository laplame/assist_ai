export type TipoJornada = 'diurna' | 'nocturna' | 'mixta';

export interface ParametrosAnio {
  anio: number;
  jornadaOrdinariaSemanal: number;
  topeDoblesSemana: number;
  maxExtraPorDia: number;
  maxDiasConExtra: number;
  topeAbsolutoExtra: number;
}

const POR_ANIO: Record<number, ParametrosAnio> = {
  2026: { anio: 2026, jornadaOrdinariaSemanal: 48, topeDoblesSemana: 9, maxExtraPorDia: 4, maxDiasConExtra: 4, topeAbsolutoExtra: 13 },
  2027: { anio: 2027, jornadaOrdinariaSemanal: 46, topeDoblesSemana: 9, maxExtraPorDia: 4, maxDiasConExtra: 4, topeAbsolutoExtra: 13 },
  2028: { anio: 2028, jornadaOrdinariaSemanal: 44, topeDoblesSemana: 10, maxExtraPorDia: 4, maxDiasConExtra: 4, topeAbsolutoExtra: 14 },
  2029: { anio: 2029, jornadaOrdinariaSemanal: 42, topeDoblesSemana: 11, maxExtraPorDia: 4, maxDiasConExtra: 4, topeAbsolutoExtra: 15 },
  2030: { anio: 2030, jornadaOrdinariaSemanal: 40, topeDoblesSemana: 12, maxExtraPorDia: 4, maxDiasConExtra: 4, topeAbsolutoExtra: 16 },
};

export function parametrosAnio(anio: number): ParametrosAnio {
  return POR_ANIO[anio] ?? POR_ANIO[2030]!;
}

export function dividirHalfUp(numerador: number, denominador: number): number {
  const cociente = Math.floor(numerador / denominador);
  const residuo = numerador % denominador;
  return residuo * 2 >= denominador ? cociente + 1 : cociente;
}

export function pesosACentavos(pesos: number): number {
  const texto = pesos.toFixed(2);
  const [entero, fraccion = '00'] = texto.split('.');
  return Number(entero) * 100 + Number(fraccion);
}

export function valorHoraCentavos(salarioDiarioCentavos: number, tipo: TipoJornada): number {
  if (tipo === 'diurna') return dividirHalfUp(salarioDiarioCentavos, 8);
  if (tipo === 'nocturna') return dividirHalfUp(salarioDiarioCentavos, 7);
  return dividirHalfUp(salarioDiarioCentavos * 2, 15);
}

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

export function clasificarExtra(dias: DiaTrabajado[], parametros: ParametrosAnio): ClasificacionExtra {
  const extras = dias.map((dia) => Math.max(0, dia.horasMilesimas - dia.jornadaDiariaMilesimas));
  let restantes = parametros.topeDoblesSemana * 1000;
  let dobles = 0;
  let triples = 0;
  for (const extra of extras) {
    const doblesDia = Math.min(extra, restantes);
    dobles += doblesDia;
    triples += extra - doblesDia;
    restantes -= doblesDia;
  }
  const diasConExtra = extras.filter((extra) => extra > 0).length;
  return {
    doblesMilesimas: dobles,
    triplesMilesimas: triples,
    diasConExtra,
    excedeHorasDia: extras.some((extra) => extra > parametros.maxExtraPorDia * 1000),
    excedeDiasConExtra: diasConExtra > parametros.maxDiasConExtra,
    excedeTopeAbsoluto: dobles + triples > parametros.topeAbsolutoExtra * 1000,
    excedeDoceHoras: dias.some((dia) => dia.horasMilesimas > 12_000),
  };
}

export function pagoHorasCentavos(milesimas: number, valorHora: number, factor: 2 | 3): number {
  return dividirHalfUp(milesimas * valorHora * factor, 1000);
}

export const TOPE_UMA_SEMANAL_2026_CENTAVOS = 58_655;

export interface ExencionExtra {
  pagoDoblesCentavos: number;
  pagoTriplesCentavos: number;
  pagoTotalCentavos: number;
  exentoCentavos: number;
  gravadoCentavos: number;
}

export function exencionTiempoExtra(input: {
  doblesMilesimas: number;
  triplesMilesimas: number;
  valorHoraCentavos: number;
  topeSemanalCentavos: number;
  doblesExentables: boolean;
}): ExencionExtra {
  const pagoDoblesCentavos = pagoHorasCentavos(input.doblesMilesimas, input.valorHoraCentavos, 2);
  const pagoTriplesCentavos = pagoHorasCentavos(input.triplesMilesimas, input.valorHoraCentavos, 3);
  const baseExenta = input.doblesExentables ? pagoDoblesCentavos : 0;
  const exento = Math.min(dividirHalfUp(baseExenta, 2), input.topeSemanalCentavos);
  const pagoTotalCentavos = pagoDoblesCentavos + pagoTriplesCentavos;
  return {
    pagoDoblesCentavos,
    pagoTriplesCentavos,
    pagoTotalCentavos,
    exentoCentavos: exento,
    gravadoCentavos: pagoTotalCentavos - exento,
  };
}

export interface RangoIsr {
  limiteInferiorCentavos: number;
  limiteSuperiorCentavos: number;
  cuotaFijaCentavos: number;
  porcentajeSobreExcedente: number;
}

export function isrDeTarifa(
  baseCentavos: number,
  tabla: RangoIsr[] | null,
): { ok: true; isrCentavos: number } | { ok: false; code: 'PARAMETRO_FALTANTE' } {
  if (!tabla || tabla.length === 0) return { ok: false, code: 'PARAMETRO_FALTANTE' };
  const rango = [...tabla].reverse().find((item) => baseCentavos >= item.limiteInferiorCentavos) ?? tabla[0];
  if (!rango) return { ok: false, code: 'PARAMETRO_FALTANTE' };
  const excedente = baseCentavos - rango.limiteInferiorCentavos;
  const marginal = dividirHalfUp(excedente * Math.round(rango.porcentajeSobreExcedente * 100), 10_000);
  return { ok: true, isrCentavos: rango.cuotaFijaCentavos + marginal };
}

export function integrarSbc(input: {
  pagoDoblesCentavos: number;
  pagoTriplesCentavos: number;
  excedeLimites: boolean;
}): { conservadorCentavos: number; alternoCentavos: number; diferenciaCentavos: number } {
  const conservadorCentavos = input.pagoTriplesCentavos + (input.excedeLimites ? input.pagoDoblesCentavos : 0);
  const alternoCentavos = input.excedeLimites ? input.pagoDoblesCentavos + input.pagoTriplesCentavos : 0;
  return {
    conservadorCentavos,
    alternoCentavos,
    diferenciaCentavos: conservadorCentavos - alternoCentavos,
  };
}

export type Semaforo = 'verde' | 'ambar' | 'rojo';

export function semaforoJornada(horasOrdinarias: number, tope: number): Semaforo {
  if (horasOrdinarias > tope) return 'rojo';
  if (horasOrdinarias >= tope * 0.9) return 'ambar';
  return 'verde';
}
