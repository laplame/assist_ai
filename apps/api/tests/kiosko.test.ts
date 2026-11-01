import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashDeCadena, type CuerpoChecada } from '@bizne/integridad';
import { evaluarChecada } from '../src/v1/cadena';
import { salarioBajoMinimo } from '../src/v1/errors';

const base: CuerpoChecada = {
  id: '6f1b0b4e-6e3a-4c1d-9c2a-0d5a6b7c8d9e',
  seq: 1,
  empleadoId: 'mem-ana',
  tipo: 'entrada',
  tsDispositivo: 1_700_000_000_000,
  offsetAplicado: 0,
  fotoSha256: 'foto',
  metodoIdentificacion: 'pin',
  huellaOsConfirmada: false,
};

describe('checadas del kiosko', () => {
  it('acepta la primera checada y rechaza un hueco de secuencia', () => {
    const primera = { ...base, hashPrev: 'GENESIS', hashActual: hashDeCadena('GENESIS', base), salt: 's', hojaMerkle: 'h', deviceId: 'd' };
    assert.equal(evaluarChecada(null, primera).estado, 'ok');
    const rota = { ...primera, seq: 3, hashPrev: primera.hashActual, hashActual: hashDeCadena(primera.hashActual, { ...base, seq: 3 }) };
    assert.equal(evaluarChecada({ seq: 1, hashActual: primera.hashActual }, rota).motivo, 'HUECO_SEQ');
  });

  it('el salario bajo el mínimo responde 422', () => {
    const error = salarioBajoMinimo(31504);
    assert.equal(error.status, 422);
    assert.equal(error.code, 'BAJO_MINIMO');
    assert.match(error.message, /315\.04/);
  });
});
