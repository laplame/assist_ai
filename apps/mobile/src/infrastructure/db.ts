import * as SQLite from 'expo-sqlite';
import { hashDeCadena, hashPin, hojaMerkle, inferirTipo, type CuerpoChecada, type TipoChecada } from '@bizne/integridad';

export interface EmpleadoLocal {
  id: string;
  nombre: string;
  pinHash: string;
  salt: string;
  rol: string;
}

export interface ChecadaLocal {
  id: string;
  seq: number;
  empleadoId: string;
  tipo: string;
  tsDispositivo: number;
  offsetAplicado: number;
  fotoSha256: string;
  metodoIdentificacion: string;
  huellaOsConfirmada: number;
  hashPrev: string;
  hashActual: string;
  salt: string;
  hojaMerkle: string;
  estadoSync: string;
  nombre?: string;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function database(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= SQLite.openDatabaseAsync('kiosko.db').then(async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT);
      CREATE TABLE IF NOT EXISTS empleados (
        id TEXT PRIMARY KEY, nombre TEXT, pinHash TEXT, salt TEXT, rol TEXT
      );
      CREATE TABLE IF NOT EXISTS checadas (
        id TEXT PRIMARY KEY,
        seq INTEGER NOT NULL,
        empleadoId TEXT NOT NULL,
        tipo TEXT NOT NULL,
        tsDispositivo INTEGER NOT NULL,
        offsetAplicado INTEGER NOT NULL,
        fotoSha256 TEXT NOT NULL,
        metodoIdentificacion TEXT NOT NULL,
        huellaOsConfirmada INTEGER NOT NULL,
        hashPrev TEXT NOT NULL,
        hashActual TEXT NOT NULL,
        salt TEXT NOT NULL,
        hojaMerkle TEXT NOT NULL,
        estadoSync TEXT NOT NULL
      );
    `);
    return db;
  });
  return dbPromise;
}

export async function guardarConfig(clave: string, valor: string): Promise<void> {
  const db = await database();
  await db.runAsync('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor', clave, valor);
}

export async function leerConfig(clave: string): Promise<string | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ valor: string }>('SELECT valor FROM config WHERE clave = ?', clave);
  return row?.valor ?? null;
}

export async function reemplazarEmpleados(empleados: EmpleadoLocal[]): Promise<void> {
  const db = await database();
  await db.execAsync('DELETE FROM empleados');
  for (const empleado of empleados) {
    await db.runAsync(
      'INSERT INTO empleados (id, nombre, pinHash, salt, rol) VALUES (?, ?, ?, ?, ?)',
      empleado.id,
      empleado.nombre,
      empleado.pinHash,
      empleado.salt,
      empleado.rol,
    );
  }
}

export async function buscarPorPin(pin: string): Promise<EmpleadoLocal | null> {
  const db = await database();
  const empleados = await db.getAllAsync<EmpleadoLocal>('SELECT id, nombre, pinHash, salt, rol FROM empleados');
  return empleados.find((empleado) => hashPin(empleado.salt, pin) === empleado.pinHash) ?? null;
}

export async function contarPendientes(): Promise<number> {
  const db = await database();
  const row = await db.getFirstAsync<{ total: number }>("SELECT COUNT(*) AS total FROM checadas WHERE estadoSync = 'pendiente'");
  return row?.total ?? 0;
}

export async function checadasPendientes(): Promise<ChecadaLocal[]> {
  const db = await database();
  return db.getAllAsync<ChecadaLocal>("SELECT * FROM checadas WHERE estadoSync = 'pendiente' ORDER BY seq ASC LIMIT 20");
}

export async function marcarSincronizadas(ids: string[]): Promise<void> {
  const db = await database();
  for (const id of ids) await db.runAsync("UPDATE checadas SET estadoSync = 'foto_ok' WHERE id = ?", id);
}

export async function checadasRecientes(empleadoId: string): Promise<ChecadaLocal[]> {
  const db = await database();
  const desde = Date.now() - 14 * 24 * 60 * 60 * 1000;
  return db.getAllAsync<ChecadaLocal>(
    'SELECT * FROM checadas WHERE empleadoId = ? AND tsDispositivo >= ? ORDER BY seq DESC',
    empleadoId,
    desde,
  );
}

export async function resumenDia(): Promise<{ total: number; pendientes: number }> {
  const db = await database();
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const total = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM checadas WHERE tsDispositivo >= ?', inicio.getTime());
  return { total: total?.total ?? 0, pendientes: await contarPendientes() };
}

export async function crearChecada(input: {
  empleadoId: string;
  tipoForzado?: TipoChecada;
  fotoSha256: string;
  metodoIdentificacion: string;
  huellaOsConfirmada: boolean;
}): Promise<ChecadaLocal> {
  const db = await database();
  const anterior = await db.getFirstAsync<ChecadaLocal>('SELECT * FROM checadas ORDER BY seq DESC LIMIT 1');
  const delEmpleado = await db.getFirstAsync<{ tipo: string }>(
    'SELECT tipo FROM checadas WHERE empleadoId = ? ORDER BY seq DESC LIMIT 1',
    input.empleadoId,
  );
  const seq = (anterior?.seq ?? 0) + 1;
  const hashPrev = anterior?.hashActual ?? 'GENESIS';
  const id = crearId();
  const salt = Math.random().toString(16).slice(2);
  const tipo = input.tipoForzado ?? inferirTipo((delEmpleado?.tipo as TipoChecada | undefined) ?? null);
  const cuerpo: CuerpoChecada = {
    id,
    seq,
    empleadoId: input.empleadoId,
    tipo,
    tsDispositivo: Date.now(),
    offsetAplicado: 0,
    fotoSha256: input.fotoSha256,
    metodoIdentificacion: input.metodoIdentificacion,
    huellaOsConfirmada: input.huellaOsConfirmada,
  };
  const hashActual = hashDeCadena(hashPrev, cuerpo);
  const hoja = hojaMerkle({
    empleadoRef: input.empleadoId,
    tipo,
    ts: cuerpo.tsDispositivo,
    dispositivoId: (await leerConfig('deviceId')) ?? 'local',
    seq,
    hashFoto: input.fotoSha256,
    salt,
  });
  await db.runAsync(
    `INSERT INTO checadas (
      id, seq, empleadoId, tipo, tsDispositivo, offsetAplicado, fotoSha256, metodoIdentificacion,
      huellaOsConfirmada, hashPrev, hashActual, salt, hojaMerkle, estadoSync
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
    id,
    seq,
    input.empleadoId,
    tipo,
    cuerpo.tsDispositivo,
    0,
    input.fotoSha256,
    input.metodoIdentificacion,
    input.huellaOsConfirmada ? 1 : 0,
    hashPrev,
    hashActual,
    salt,
    hoja,
  );
  return { ...cuerpo, hashPrev, hashActual, salt, hojaMerkle: hoja, estadoSync: 'pendiente', huellaOsConfirmada: input.huellaOsConfirmada ? 1 : 0 };
}

function crearId(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function borrarDatosLocales(): Promise<void> {
  const db = await database();
  await db.execAsync('DELETE FROM checadas; DELETE FROM empleados; DELETE FROM config;');
}
