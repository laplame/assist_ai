import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { horasDeJornada, passcodeSincronizacionValido, sincronizacionKioskoSchema, tipoDeJornada } from '../src/v1/esquemasKiosko';

const paquete = {
  passcode: '1234',
  androidIdHash: 'a'.repeat(64),
  sucursal: { id: 'suc-1', nombre: 'Centro', estado: 'Jalisco', municipio: 'Guadalajara' },
  admin: { id: 'local-admin', nombre: 'Ana Admin', pinHash: 'b'.repeat(64), salt: 'salto', rol: 'admin' as const },
};

describe('esquema de sincronización del kiosko', () => {
  it('acepta el alta de sucursal y admin con el código 1234', () => {
    const data = sincronizacionKioskoSchema.parse(paquete);
    assert.equal(data.sucursal.nombre, 'Centro');
    assert.equal(data.admin.rol, 'admin');
    assert.deepEqual(data.checadas, []);
    assert.equal(passcodeSincronizacionValido(data.passcode), true);
  });

  it('rechaza otro código y una sucursal sin nombre', () => {
    assert.equal(passcodeSincronizacionValido('0000'), false);
    assert.equal(passcodeSincronizacionValido('12345'), false);
    assert.throws(() => sincronizacionKioskoSchema.parse({ ...paquete, sucursal: { ...paquete.sucursal, nombre: 'A' } }));
  });

  it('traduce la jornada a horas y de vuelta', () => {
    assert.equal(horasDeJornada('diurna'), 8);
    assert.equal(horasDeJornada('nocturna'), 7);
    assert.equal(tipoDeJornada(7.5), 'mixta');
  });
});
