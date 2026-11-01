import * as SQLite from 'expo-sqlite';
import { hashDeCadena, hashPin, hojaMerkle, inferirTipo, type CuerpoChecada, type TipoChecada } from '@bizne/integridad';

export interface EmpleadoLocal {
  id: string;
  nombre: string;
  pinHash: string;
  salt: string;
  rol: string;
}

export interface ColaboradorLocal {
  id: string;
  nombre: string;
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
      CREATE TABLE IF NOT EXISTS altas_locales (
        id TEXT PRIMARY KEY, nombre TEXT, pinHash TEXT, salt TEXT, rol TEXT
      );
      CREATE TABLE IF NOT EXISTS pactos (
        empleadoId TEXT PRIMARY KEY,
        salarioDiarioCentavos INTEGER NOT NULL,
        tipoJornada TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sucursales (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        estado TEXT NOT NULL,
        municipio TEXT NOT NULL
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

export async function prepararModoLocal(): Promise<void> {
  await guardarConfig('modo', 'local');
  await guardarConfig('sucursal', 'Sucursal Roma');
  await guardarConfig('sucursalId', 'suc-roma');
  await guardarConfig('deviceId', 'local-dev');
  const db = await database();
  await db.runAsync(
    'INSERT INTO sucursales (id, nombre, estado, municipio) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
    'suc-roma',
    'Sucursal Roma',
    'Ciudad de México',
    'Cuauhtémoc',
  );
  await reemplazarEmpleados([
    { id: 'mem-admin', nombre: 'Admin Roma', salt: 'dev-admin', pinHash: hashPin('dev-admin', '9753'), rol: 'admin' },
    { id: 'mem-ana', nombre: 'Ana López', salt: 'dev-ana', pinHash: hashPin('dev-ana', '2580'), rol: 'empleado' },
  ]);
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
  const altas = await db.getAllAsync<EmpleadoLocal>('SELECT id, nombre, pinHash, salt, rol FROM altas_locales');
  for (const alta of altas) {
    const ya = await db.getFirstAsync<{ id: string }>('SELECT id FROM empleados WHERE id = ?', alta.id);
    if (ya) continue;
    await db.runAsync(
      'INSERT INTO empleados (id, nombre, pinHash, salt, rol) VALUES (?, ?, ?, ?, ?)',
      alta.id,
      alta.nombre,
      alta.pinHash,
      alta.salt,
      alta.rol,
    );
  }
}

export async function agregarColaborador(input: { nombre: string; pin: string }): Promise<'ok' | 'pin_en_uso'> {
  if (await buscarPorPin(input.pin)) return 'pin_en_uso';
  const db = await database();
  const salt = crearSalt();
  const id = `local-${crearId()}`;
  const pinHash = hashPin(salt, input.pin);
  await db.runAsync(
    'INSERT INTO altas_locales (id, nombre, pinHash, salt, rol) VALUES (?, ?, ?, ?, ?)',
    id,
    input.nombre,
    pinHash,
    salt,
    'empleado',
  );
  await db.runAsync(
    'INSERT INTO empleados (id, nombre, pinHash, salt, rol) VALUES (?, ?, ?, ?, ?)',
    id,
    input.nombre,
    pinHash,
    salt,
    'empleado',
  );
  return 'ok';
}

export interface PactoLocal {
  empleadoId: string;
  salarioDiarioCentavos: number;
  tipoJornada: string;
}

export async function guardarPacto(pacto: PactoLocal): Promise<void> {
  const db = await database();
  await db.runAsync(
    'INSERT INTO pactos (empleadoId, salarioDiarioCentavos, tipoJornada) VALUES (?, ?, ?) ON CONFLICT(empleadoId) DO UPDATE SET salarioDiarioCentavos = excluded.salarioDiarioCentavos, tipoJornada = excluded.tipoJornada',
    pacto.empleadoId,
    pacto.salarioDiarioCentavos,
    pacto.tipoJornada,
  );
}

export async function leerPacto(empleadoId: string): Promise<PactoLocal | null> {
  const db = await database();
  return db.getFirstAsync<PactoLocal>('SELECT empleadoId, salarioDiarioCentavos, tipoJornada FROM pactos WHERE empleadoId = ?', empleadoId);
}

export async function checadasDeEmpleado(empleadoId: string, desdeMs: number, hastaMs: number): Promise<ChecadaLocal[]> {
  const db = await database();
  return db.getAllAsync<ChecadaLocal>(
    'SELECT * FROM checadas WHERE empleadoId = ? AND tsDispositivo >= ? AND tsDispositivo <= ? ORDER BY tsDispositivo ASC',
    empleadoId,
    desdeMs,
    hastaMs,
  );
}

export async function checadasDesde(desdeMs: number): Promise<ChecadaLocal[]> {
  const db = await database();
  return db.getAllAsync<ChecadaLocal>('SELECT * FROM checadas WHERE tsDispositivo >= ? ORDER BY tsDispositivo ASC', desdeMs);
}

export interface SucursalLocal {
  id: string;
  nombre: string;
  estado: string;
  municipio: string;
}

export async function listarSucursales(): Promise<SucursalLocal[]> {
  const db = await database();
  const total = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM sucursales');
  if ((total?.total ?? 0) === 0) {
    const id = (await leerConfig('sucursalId')) ?? 'suc-roma';
    const nombre = (await leerConfig('sucursal')) ?? 'Sucursal Roma';
    const demo = id === 'suc-roma';
    await db.runAsync(
      'INSERT INTO sucursales (id, nombre, estado, municipio) VALUES (?, ?, ?, ?)',
      id,
      nombre,
      demo ? 'Ciudad de México' : '',
      demo ? 'Cuauhtémoc' : '',
    );
  }
  return db.getAllAsync<SucursalLocal>('SELECT id, nombre, estado, municipio FROM sucursales ORDER BY nombre');
}

export async function agregarSucursal(input: { nombre: string; estado: string; municipio: string }): Promise<'nombre_en_uso' | string> {
  const db = await database();
  const existentes = await db.getAllAsync<{ nombre: string }>('SELECT nombre FROM sucursales');
  const nombre = input.nombre.trim();
  if (existentes.some((item) => item.nombre.trim().toLowerCase() === nombre.toLowerCase())) return 'nombre_en_uso';
  const id = `suc-${crearId()}`;
  await db.runAsync(
    'INSERT INTO sucursales (id, nombre, estado, municipio) VALUES (?, ?, ?, ?)',
    id,
    nombre,
    input.estado.trim(),
    input.municipio.trim(),
  );
  await guardarConfig('sucursal', nombre);
  await guardarConfig('sucursalId', id);
  return id;
}

export async function altaInicial(input: {
  sucursal: { nombre: string; estado: string; municipio: string };
  admin: { nombre: string; pin: string };
}): Promise<void> {
  const db = await database();
  const sucursalId = (await leerConfig('sucursalId')) ?? `suc-${crearId()}`;
  const adminId = (await leerConfig('adminId')) ?? `local-${crearId()}`;
  const nombre = input.sucursal.nombre.trim();
  const estado = input.sucursal.estado.trim();
  const municipio = input.sucursal.municipio.trim();
  await db.runAsync(
    `INSERT INTO sucursales (id, nombre, estado, municipio) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, estado = excluded.estado, municipio = excluded.municipio`,
    sucursalId,
    nombre,
    estado,
    municipio,
  );
  const previa = await db.getFirstAsync<{ salt: string }>('SELECT salt FROM empleados WHERE id = ?', adminId);
  const salt = previa?.salt ?? crearSalt();
  const pinHash = hashPin(salt, input.admin.pin);
  const adminNombre = input.admin.nombre.trim();
  await db.runAsync(
    `INSERT INTO empleados (id, nombre, pinHash, salt, rol) VALUES (?, ?, ?, ?, 'admin')
     ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, pinHash = excluded.pinHash, salt = excluded.salt, rol = 'admin'`,
    adminId,
    adminNombre,
    pinHash,
    salt,
  );
  await db.runAsync(
    `INSERT INTO altas_locales (id, nombre, pinHash, salt, rol) VALUES (?, ?, ?, ?, 'admin')
     ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, pinHash = excluded.pinHash, salt = excluded.salt, rol = 'admin'`,
    adminId,
    adminNombre,
    pinHash,
    salt,
  );
  await guardarConfig('modo', 'local');
  await guardarConfig('sucursal', nombre);
  await guardarConfig('sucursalId', sucursalId);
  await guardarConfig('adminId', adminId);
  if (!(await leerConfig('deviceId'))) await guardarConfig('deviceId', `local-${crearId()}`);
  await guardarConfig('onboarding', 'sync');
}

export interface PaqueteLocal {
  sucursal: SucursalLocal;
  admin: EmpleadoLocal;
  sucursales: SucursalLocal[];
  empleados: EmpleadoLocal[];
  pactos: PactoLocal[];
  checadas: ChecadaLocal[];
}

export async function exportarPaqueteLocal(): Promise<PaqueteLocal> {
  const db = await database();
  const sucursalId = await leerConfig('sucursalId');
  const adminId = await leerConfig('adminId');
  const sucursales = await db.getAllAsync<SucursalLocal>('SELECT id, nombre, estado, municipio FROM sucursales ORDER BY nombre');
  const sucursal = sucursales.find((item) => item.id === sucursalId) ?? sucursales[0];
  if (!sucursal) throw new Error('Falta la sucursal.');
  const empleados = await db.getAllAsync<EmpleadoLocal>('SELECT id, nombre, pinHash, salt, rol FROM empleados');
  const admin = empleados.find((item) => item.id === adminId) ?? empleados.find((item) => item.rol === 'admin');
  if (!admin) throw new Error('Falta el admin.');
  const pactos = await db.getAllAsync<PactoLocal>('SELECT empleadoId, salarioDiarioCentavos, tipoJornada FROM pactos');
  return { sucursal, admin, sucursales, empleados, pactos, checadas: await checadasPendientes() };
}

export async function aplicarCatalogo(input: {
  sucursales: SucursalLocal[];
  empleados: EmpleadoLocal[];
  pactos: PactoLocal[];
  sucursalId: string;
  sucursalNombre: string;
}): Promise<void> {
  const db = await database();
  for (const sucursal of input.sucursales) {
    await db.runAsync(
      `INSERT INTO sucursales (id, nombre, estado, municipio) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, estado = excluded.estado, municipio = excluded.municipio`,
      sucursal.id,
      sucursal.nombre,
      sucursal.estado,
      sucursal.municipio,
    );
  }
  await reemplazarEmpleados(input.empleados);
  for (const pacto of input.pactos) await guardarPacto(pacto);
  await guardarConfig('sucursalId', input.sucursalId);
  await guardarConfig('sucursal', input.sucursalNombre);
}

export async function elegirSucursal(id: string): Promise<void> {
  const db = await database();
  const sucursal = await db.getFirstAsync<SucursalLocal>('SELECT id, nombre, estado, municipio FROM sucursales WHERE id = ?', id);
  if (!sucursal) return;
  await guardarConfig('sucursal', sucursal.nombre);
  await guardarConfig('sucursalId', sucursal.id);
}

export async function listarColaboradores(): Promise<ColaboradorLocal[]> {
  const db = await database();
  return db.getAllAsync<ColaboradorLocal>('SELECT id, nombre, rol FROM empleados ORDER BY nombre');
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
  await db.execAsync('DELETE FROM checadas; DELETE FROM empleados; DELETE FROM altas_locales; DELETE FROM pactos; DELETE FROM sucursales; DELETE FROM config;');
}

function crearSalt(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
