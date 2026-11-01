import {
  TOPE_UMA_SEMANAL_2026_CENTAVOS,
  clasificarExtra,
  dividirHalfUp,
  exencionTiempoExtra,
  parametrosAnio,
  pesosACentavos,
  semaforoJornada,
  valorHoraCentavos,
  type TipoJornada,
} from '@bizne/calculo';
import { checadasDeEmpleado, type ChecadaLocal } from './db';

const jornadaMilesimas: Record<TipoJornada, number> = {
  diurna: 8_000,
  nocturna: 7_000,
  mixta: 7_500,
};

export interface DiaCalculado {
  etiqueta: string;
  horasMilesimas: number;
  nota: string | null;
}

export interface CalculoSemana {
  desde: string;
  hasta: string;
  ordinariasMilesimas: number;
  doblesMilesimas: number;
  triplesMilesimas: number;
  valorHoraCentavos: number;
  pagoNormalCentavos: number;
  pagoExtraCentavos: number;
  totalCentavos: number;
  semaforo: 'verde' | 'ambar' | 'rojo';
  avisoLimite: string | null;
  dias: DiaCalculado[];
}

export function leerCentavos(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null;
  const centavos = pesosACentavos(Number(limpio));
  return centavos > 0 ? centavos : null;
}

export async function calcularSemana(input: {
  empleadoId: string;
  salarioDiarioCentavos: number;
  tipoJornada: TipoJornada;
  ahora?: Date;
}): Promise<CalculoSemana> {
  const ahora = input.ahora ?? new Date();
  const inicio = inicioDeSemana(ahora);
  const fin = new Date(ahora);
  fin.setHours(23, 59, 59, 999);
  const checadas = await checadasDeEmpleado(input.empleadoId, inicio.getTime(), fin.getTime());
  const porDia = agruparPorDia(checadas);
  const jornada = jornadaMilesimas[input.tipoJornada];
  const dias: DiaCalculado[] = [];
  const trabajados: Array<{ horasMilesimas: number; jornadaDiariaMilesimas: number }> = [];
  for (let cursor = new Date(inicio); cursor <= fin; cursor.setDate(cursor.getDate() + 1)) {
    const clave = claveDia(cursor);
    const eventos = porDia.get(clave) ?? [];
    const medido = horasDelDia(eventos);
    dias.push({
      etiqueta: cursor.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }),
      horasMilesimas: medido.milesimas,
      nota: medido.nota,
    });
    if (medido.milesimas > 0) trabajados.push({ horasMilesimas: medido.milesimas, jornadaDiariaMilesimas: jornada });
  }
  const parametros = parametrosAnio(ahora.getFullYear());
  const clasificacion = clasificarExtra(trabajados, parametros);
  const ordinarias = trabajados.reduce((suma, dia) => suma + Math.min(dia.horasMilesimas, dia.jornadaDiariaMilesimas), 0);
  const valor = valorHoraCentavos(input.salarioDiarioCentavos, input.tipoJornada);
  const pagoNormal = dividirHalfUp(ordinarias * valor, 1000);
  const pago = exencionTiempoExtra({
    doblesMilesimas: clasificacion.doblesMilesimas,
    triplesMilesimas: clasificacion.triplesMilesimas,
    valorHoraCentavos: valor,
    topeSemanalCentavos: TOPE_UMA_SEMANAL_2026_CENTAVOS,
    doblesExentables: !clasificacion.excedeHorasDia && !clasificacion.excedeDiasConExtra,
  });
  const totalHoras = trabajados.reduce((suma, dia) => suma + dia.horasMilesimas, 0) / 1000;
  const avisos = [
    clasificacion.excedeHorasDia ? 'Hay un día con más de 4 horas extra.' : null,
    clasificacion.excedeDiasConExtra ? 'Hay extra en más de 4 días.' : null,
    clasificacion.excedeDoceHoras ? 'Hay un día con más de 12 horas.' : null,
  ].filter((aviso): aviso is string => aviso !== null);
  return {
    desde: inicio.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }),
    hasta: fin.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }),
    ordinariasMilesimas: ordinarias,
    doblesMilesimas: clasificacion.doblesMilesimas,
    triplesMilesimas: clasificacion.triplesMilesimas,
    valorHoraCentavos: valor,
    pagoNormalCentavos: pagoNormal,
    pagoExtraCentavos: pago.pagoTotalCentavos,
    totalCentavos: pagoNormal + pago.pagoTotalCentavos,
    semaforo: semaforoJornada(totalHoras, parametros.jornadaOrdinariaSemanal),
    avisoLimite: avisos.length > 0 ? avisos.join(' ') : null,
    dias,
  };
}

function inicioDeSemana(ahora: Date): Date {
  const inicio = new Date(ahora);
  const dia = inicio.getDay();
  inicio.setDate(inicio.getDate() - (dia === 0 ? 6 : dia - 1));
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

function claveDia(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

function agruparPorDia(checadas: ChecadaLocal[]): Map<string, ChecadaLocal[]> {
  const grupos = new Map<string, ChecadaLocal[]>();
  for (const checada of checadas) {
    const clave = claveDia(new Date(checada.tsDispositivo));
    const lista = grupos.get(clave) ?? [];
    lista.push(checada);
    grupos.set(clave, lista);
  }
  return grupos;
}

function horasDelDia(eventos: ChecadaLocal[]): { milesimas: number; nota: string | null } {
  let estado: 'fuera' | 'dentro' | 'pausa' = 'fuera';
  let marca = 0;
  let milisegundos = 0;
  for (const evento of eventos) {
    if (evento.tipo === 'entrada' && estado === 'fuera') {
      estado = 'dentro';
      marca = evento.tsDispositivo;
    } else if ((evento.tipo === 'pausa_inicio' || evento.tipo === 'comida_inicio') && estado === 'dentro') {
      milisegundos += evento.tsDispositivo - marca;
      estado = 'pausa';
    } else if ((evento.tipo === 'pausa_fin' || evento.tipo === 'comida_fin') && estado === 'pausa') {
      estado = 'dentro';
      marca = evento.tsDispositivo;
    } else if (evento.tipo === 'salida') {
      if (estado === 'dentro') milisegundos += evento.tsDispositivo - marca;
      estado = 'fuera';
    }
  }
  if (milisegundos < 0) milisegundos = 0;
  const nota = estado === 'fuera' ? null : 'Sin salida. Esas horas no entran al cálculo.';
  return { milesimas: Math.round(milisegundos / 3600), nota };
}
