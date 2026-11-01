import * as Application from 'expo-application';
import { sha256Hex, utf8 } from '@bizne/integridad';
import {
  aplicarCatalogo,
  checadasPendientes,
  exportarPaqueteLocal,
  guardarConfig,
  leerConfig,
  marcarSincronizadas,
  reemplazarEmpleados,
  type ChecadaLocal,
} from './db';
import { guardarToken } from './secure';

async function raizApi(explicita?: string): Promise<string> {
  const guardada = explicita ?? (await leerConfig('apiUrl'));
  return (guardada || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/$/, '');
}

export async function hayServidor(): Promise<boolean> {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), 2500);
  try {
    const response = await fetch(`${await raizApi()}/health`, { signal: control.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function emparejar(input: { codigo: string; lat: number; lng: number }): Promise<{ sucursal: string; deviceToken: string }> {
  const androidId = Application.getAndroidId() ?? `kiosko-${input.codigo}`;
  const androidIdHash = sha256Hex(utf8(androidId));
  const data = await request<{ deviceToken: string; deviceId: string; sucursal: string; sucursalId: string; tenantId: string }>(
    '/api/v1/dispositivos/emparejar',
    null,
    { codigo: input.codigo.trim().toUpperCase(), androidIdHash, modelo: 'android', lat: input.lat, lng: input.lng },
  );
  await guardarToken(data.deviceToken);
  await guardarConfig('modo', 'api');
  await guardarConfig('deviceId', data.deviceId);
  await guardarConfig('sucursal', data.sucursal);
  await guardarConfig('sucursalId', data.sucursalId);
  return data;
}

export async function sincronizar(token: string): Promise<{ enviadas: number }> {
  if (token === 'local') return { enviadas: 0 };
  const pendientes = await checadasPendientes();
  const enviadas = pendientes.length
    ? await request<{ resultados: Array<{ id: string; estado: string }> }>('/api/v1/dispositivos/checadas/lote', token, {
        checadas: pendientes.map(aLote),
      }).then(async (respuesta) => {
        const ok = respuesta.resultados.filter((item) => item.estado === 'ok' || item.estado === 'duplicada').map((item) => item.id);
        await marcarSincronizadas(ok);
        return ok.length;
      })
    : 0;
  const catalogo = await request<{
    empleados: Array<{ id: string; nombre: string; pinHash: string; salt: string; rol: string }>;
    serverTime: string;
  }>('/api/v1/dispositivos/sincronizacion', token);
  await reemplazarEmpleados(catalogo.empleados);
  await guardarConfig('ultimaSyncOk', catalogo.serverTime);
  return { enviadas };
}

export async function sincronizarArranque(input: { url: string; passcode: string }): Promise<{ sucursal: string }> {
  const base = input.url.trim().replace(/\/$/, '');
  if (!/^https?:\/\//i.test(base)) throw new Error('La URL tiene que empezar con http:// o https://');
  if (input.passcode !== '1234') throw new Error('El código de sincronización es 1234.');
  const paquete = await exportarPaqueteLocal();
  const androidId = Application.getAndroidId() ?? `kiosko-${paquete.sucursal.id}`;
  const data = await request<{
    deviceToken: string;
    deviceId: string;
    sucursalId: string;
    sucursal: string;
    sucursales: Array<{ id: string; nombre: string; estado: string; municipio: string }>;
    empleados: Array<{ id: string; nombre: string; pinHash: string; salt: string; rol: string }>;
    pactos: Array<{ empleadoId: string; salarioDiarioCentavos: number; tipoJornada: string }>;
    checadas: Array<{ id: string; estado: string }>;
  }>(
    '/api/v1/kiosko/sincronizar',
    null,
    {
      passcode: input.passcode,
      androidIdHash: sha256Hex(utf8(androidId)),
      modelo: 'android',
      sucursal: paquete.sucursal,
      admin: paquete.admin,
      sucursales: paquete.sucursales,
      empleados: paquete.empleados,
      pactos: paquete.pactos,
      checadas: paquete.checadas.map(aLote),
    },
    'POST',
    base,
  );
  await guardarConfig('apiUrl', base);
  await guardarToken(data.deviceToken);
  await guardarConfig('modo', 'api');
  await guardarConfig('deviceId', data.deviceId);
  await aplicarCatalogo({
    sucursales: data.sucursales,
    empleados: data.empleados,
    pactos: data.pactos,
    sucursalId: data.sucursalId,
    sucursalNombre: data.sucursal,
  });
  await marcarSincronizadas(data.checadas.filter((item) => item.estado === 'ok' || item.estado === 'duplicada').map((item) => item.id));
  await guardarConfig('onboarding', 'listo');
  return { sucursal: data.sucursal };
}

function aLote(checada: ChecadaLocal) {
  return {
    id: checada.id,
    seq: checada.seq,
    empleadoId: checada.empleadoId,
    tipo: checada.tipo,
    tsDispositivo: checada.tsDispositivo,
    offsetAplicado: checada.offsetAplicado,
    fotoSha256: checada.fotoSha256,
    metodoIdentificacion: checada.metodoIdentificacion,
    huellaOsConfirmada: checada.huellaOsConfirmada === 1,
    hashPrev: checada.hashPrev,
    hashActual: checada.hashActual,
    salt: checada.salt,
    hojaMerkle: checada.hojaMerkle,
  };
}

async function request<T>(path: string, token: string | null, body?: unknown, method = body ? 'POST' : 'GET', base?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${await raizApi(base)}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Sin red. La checada queda en el teléfono.');
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
    if (payload?.code === 'REVOCADO') throw new Error('Dispositivo desvinculado');
    throw new Error(payload?.error ?? `Error ${response.status}`);
  }
  return response.json() as Promise<T>;
}
