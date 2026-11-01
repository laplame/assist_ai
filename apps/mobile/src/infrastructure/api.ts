import * as Application from 'expo-application';
import { sha256Hex, utf8 } from '@bizne/integridad';
import { checadasPendientes, guardarConfig, marcarSincronizadas, reemplazarEmpleados, type ChecadaLocal } from './db';
import { guardarToken } from './secure';

const apiBase = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export async function emparejar(input: { codigo: string; lat: number; lng: number }): Promise<{ sucursal: string; deviceToken: string }> {
  const androidId = Application.getAndroidId() ?? `kiosko-${input.codigo}`;
  const androidIdHash = sha256Hex(utf8(androidId));
  const data = await request<{ deviceToken: string; deviceId: string; sucursal: string; sucursalId: string; tenantId: string }>(
    '/api/v1/dispositivos/emparejar',
    null,
    { codigo: input.codigo.trim().toUpperCase(), androidIdHash, modelo: 'android', lat: input.lat, lng: input.lng },
  );
  await guardarToken(data.deviceToken);
  await guardarConfig('deviceId', data.deviceId);
  await guardarConfig('sucursal', data.sucursal);
  await guardarConfig('sucursalId', data.sucursalId);
  return data;
}

export async function sincronizar(token: string): Promise<{ enviadas: number }> {
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

async function request<T>(path: string, token: string | null, body?: unknown, method = body ? 'POST' : 'GET'): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
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
