import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TOPE_UMA_SEMANAL_2026_CENTAVOS,
  clasificarExtra,
  exencionTiempoExtra,
  integrarSbc,
  isrDeTarifa,
  parametrosAnio,
  pesosACentavos,
  valorHoraCentavos,
} from '../src/index';

describe('cálculo de tiempo extra', () => {
  it('paga 9 dobles y 1 triple con exención del 50 %', () => {
    const clasificacion = clasificarExtra(
      [{ horasMilesimas: 18_000, jornadaDiariaMilesimas: 8_000 }],
      parametrosAnio(2026),
    );
    const pago = exencionTiempoExtra({
      doblesMilesimas: clasificacion.doblesMilesimas,
      triplesMilesimas: clasificacion.triplesMilesimas,
      valorHoraCentavos: 5_000,
      topeSemanalCentavos: TOPE_UMA_SEMANAL_2026_CENTAVOS,
      doblesExentables: true,
    });
    assert.equal(pago.pagoDoblesCentavos, 90_000);
    assert.equal(pago.pagoTriplesCentavos, 15_000);
    assert.equal(pago.pagoTotalCentavos, 105_000);
    assert.equal(pago.exentoCentavos, 45_000);
    assert.equal(pago.gravadoCentavos, 60_000);
  });

  it('el tope semanal de 5 UMA corta la exención', () => {
    const pago = exencionTiempoExtra({
      doblesMilesimas: 18_750,
      triplesMilesimas: 0,
      valorHoraCentavos: 5_000,
      topeSemanalCentavos: TOPE_UMA_SEMANAL_2026_CENTAVOS,
      doblesExentables: true,
    });
    assert.equal(pago.pagoDoblesCentavos, 187_500);
    assert.equal(pago.exentoCentavos, 58_655);
    assert.equal(pago.gravadoCentavos, 128_845);
  });

  it('deriva el valor de la hora en centavos', () => {
    assert.equal(valorHoraCentavos(pesosACentavos(400), 'diurna'), 5_000);
    assert.equal(valorHoraCentavos(pesosACentavos(400), 'nocturna'), 5_714);
    assert.equal(valorHoraCentavos(pesosACentavos(400), 'mixta'), 5_333);
  });

  it('usa el tope del año de cada fecha', () => {
    assert.equal(parametrosAnio(2026).jornadaOrdinariaSemanal, 48);
    assert.equal(parametrosAnio(2027).jornadaOrdinariaSemanal, 46);
    assert.equal(parametrosAnio(2026).topeDoblesSemana, 9);
  });

  it('se niega a calcular ISR si falta la tarifa', () => {
    assert.deepEqual(isrDeTarifa(10_000, null), { ok: false, code: 'PARAMETRO_FALTANTE' });
    assert.deepEqual(isrDeTarifa(10_000, []), { ok: false, code: 'PARAMETRO_FALTANTE' });
  });

  it('separa el SBC conservador del alterno', () => {
    const sbc = integrarSbc({ pagoDoblesCentavos: 90_000, pagoTriplesCentavos: 15_000, excedeLimites: false });
    assert.equal(sbc.conservadorCentavos, 15_000);
    assert.equal(sbc.alternoCentavos, 0);
    assert.equal(sbc.diferenciaCentavos, 15_000);
  });
});
