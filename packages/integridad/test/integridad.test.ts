import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  armarArbol,
  esRebote,
  hashDeCadena,
  hojaMerkle,
  inferirTipo,
  sha256Hex,
  utf8,
  verificarPrueba,
  type CuerpoChecada,
  type HojaChecada,
} from '../src/index';

const cuerpo: CuerpoChecada = {
  id: '6f1b0b4e-6e3a-4c1d-9c2a-0d5a6b7c8d9e',
  seq: 1,
  empleadoId: 'mem-1',
  tipo: 'entrada',
  tsDispositivo: 1_762_000_000_000,
  offsetAplicado: 0,
  fotoSha256: 'abc',
  metodoIdentificacion: 'pin',
  huellaOsConfirmada: false,
};

const hoja: HojaChecada = {
  empleadoRef: 'opaco-1',
  tipo: 'entrada',
  ts: 1_762_000_000_000,
  dispositivoId: 'dev-1',
  seq: 1,
  hashFoto: 'abc',
  salt: 'sal',
};

describe('integridad', () => {
  it('reproduce los vectores públicos de SHA-256', () => {
    assert.equal(sha256Hex(utf8('')), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    assert.equal(sha256Hex(utf8('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('encadena checadas y detecta un byte alterado', () => {
    const primero = hashDeCadena('GENESIS', cuerpo);
    const segundo = hashDeCadena(primero, { ...cuerpo, seq: 2, tipo: 'salida' });
    assert.notEqual(primero, hashDeCadena('GENESIS', { ...cuerpo, tipo: 'salida' }));
    assert.notEqual(primero, segundo);
  });

  it('la hoja no lleva nombre ni coordenadas y un cambio de byte la mueve', () => {
    const canon = JSON.stringify(hoja);
    assert.equal(canon.includes('nombre'), false);
    assert.equal(canon.includes('lat'), false);
    const original = hojaMerkle(hoja);
    assert.notEqual(original, hojaMerkle({ ...hoja, salt: 'sal2' }));
  });

  it('arma un árbol y rechaza una prueba alterada', () => {
    const hojas = [hojaMerkle(hoja), hojaMerkle({ ...hoja, seq: 2 }), hojaMerkle({ ...hoja, seq: 3 })];
    const arbol = armarArbol(hojas);
    assert.equal(verificarPrueba(hojas[1]!, arbol.pruebas[1]!, arbol.raiz), true);
    const alterada = arbol.pruebas[1]!.map((paso, index) =>
      index === 0 ? { ...paso, hash: `${paso.hash.startsWith('a') ? 'b' : 'a'}${paso.hash.slice(1)}` } : paso,
    );
    assert.equal(verificarPrueba(hojas[1]!, alterada, arbol.raiz), false);
  });

  it('ignora un rebote de menos de 60 segundos e infiere el tipo', () => {
    assert.equal(esRebote(1_000, 30_000), true);
    assert.equal(esRebote(1_000, 61_000), false);
    assert.equal(inferirTipo(null), 'entrada');
    assert.equal(inferirTipo('entrada'), 'comida_inicio');
    assert.equal(inferirTipo('salida'), 'entrada');
  });
});
