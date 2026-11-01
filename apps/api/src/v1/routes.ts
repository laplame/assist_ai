import { randomBytes, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { armarArbol, distanciaMetros, hojaMerkle, type HojaChecada } from '@bizne/integridad';
import {
  TOPE_UMA_SEMANAL_2026_CENTAVOS,
  exencionTiempoExtra,
  integrarSbc,
  parametrosAnio,
  pesosACentavos,
  semaforoJornada,
  valorHoraCentavos,
  clasificarExtra,
  type TipoJornada,
} from '@bizne/calculo';
import { evaluarChecada } from './cadena';
import { tenantStorage } from './context';
import { ApiError, salarioBajoMinimo } from './errors';
import {
  AuditoriaModel,
  ChecadaModel,
  CodigoKioskoModel,
  DispositivoModel,
  LoteModel,
  MembresiaModel,
  MinimoModel,
  MunicipioModel,
  PactadoModel,
  ReporteSillaModel,
  SucursalModel,
  TenantModel,
  UsuarioModel,
} from './models';
import { firmar, leerToken, type Claims, type ClaimsDispositivo, type ClaimsUsuario } from './tokens';

const router = Router();

router.use((req, res, next) => {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }
  try {
    const claims = leerToken(header.slice('Bearer '.length).trim());
    res.locals.claims = claims;
    if (claims.typ === 'usuario') {
      tenantStorage.run(claims, () => next());
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
});

router.post('/auth/login', async (req, res, next) => {
  try {
    const body = z.object({ telefono: z.string().min(10), codigo: z.string().min(4) }).parse(req.body);
    const usuario = await UsuarioModel.findOne({ telefono: body.telefono, codigoAcceso: body.codigo }).lean<{
      _id: string;
      nombre: string;
    } | null>();
    if (!usuario) throw new ApiError('Teléfono o código incorrectos', 'CREDENCIALES', 401);
    const membresias = await MembresiaModel.find({ usuarioId: usuario._id, activa: true }).lean<
      Array<{ _id: string; tenantId: string; rol: ClaimsUsuario['rol']; nombre: string }>
    >();
    if (membresias.length === 1) {
      const unica = membresias[0]!;
      const token = firmar({
        typ: 'usuario',
        sub: usuario._id,
        tenantId: unica.tenantId,
        membresiaId: unica._id,
        rol: unica.rol,
      });
      res.json({ token, nombre: usuario.nombre, rol: unica.rol, tenantId: unica.tenantId });
      return;
    }
    res.json({
      ticket: firmar({ typ: 'seleccion', sub: usuario._id }, 60 * 10),
      membresias: membresias.map((item) => ({ membresiaId: item._id, tenantId: item.tenantId, rol: item.rol })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/auth/seleccionar-tenant', async (req, res, next) => {
  try {
    const body = z.object({ ticket: z.string(), membresiaId: z.string() }).parse(req.body);
    const ticket = leerToken(body.ticket);
    if (ticket.typ !== 'seleccion') throw new ApiError('Ticket inválido', 'TOKEN', 401);
    const membresia = await MembresiaModel.findOne({ _id: body.membresiaId, usuarioId: ticket.sub, activa: true }).lean<{
      _id: string;
      tenantId: string;
      rol: ClaimsUsuario['rol'];
    } | null>();
    if (!membresia) throw new ApiError('Membresía no encontrada', 'NO_ENCONTRADA', 404);
    res.json({
      token: firmar({
        typ: 'usuario',
        sub: ticket.sub,
        tenantId: membresia.tenantId,
        membresiaId: membresia._id,
        rol: membresia.rol,
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/salarios/minimo', async (req, res, next) => {
  try {
    exigirUsuario(res.locals.claims);
    const query = z
      .object({
        municipio: z.string().optional(),
        estado: z.string().optional(),
        anio: z.coerce.number().default(2026),
        sucursalId: z.string().optional(),
      })
      .parse(req.query);
    let estado = query.estado;
    let municipio = query.municipio;
    if (query.sucursalId) {
      const ctx = tenantStorage.getStore();
      const sucursal = await SucursalModel.findOne({ _id: query.sucursalId, tenantId: ctx?.tenantId }).lean<{
        estado: string;
        municipio: string;
      } | null>();
      if (!sucursal) throw new ApiError('Sucursal no encontrada', 'NO_ENCONTRADA', 404);
      estado = sucursal.estado;
      municipio = sucursal.municipio;
    }
    if (!estado || !municipio) throw new ApiError('Indica municipio y estado, o una sucursal', 'VALIDATION', 400);
    const zonaDoc = await MunicipioModel.findOne({ estado, municipio }).lean<{ zona: 'general' | 'zlfn' } | null>();
    if (!zonaDoc) throw new ApiError('Ese municipio no está en el catálogo verificado', 'ZONA_NO_CATALOGADA', 422);
    const minimo = await MinimoModel.findOne({ anio: query.anio, zona: zonaDoc.zona }).lean<{
      montoCentavos: number;
      fuente: string;
      anio: number;
    } | null>();
    if (!minimo) throw new ApiError('No hay salario mínimo para ese año', 'PARAMETRO_FALTANTE', 422);
    res.json({
      zona: zonaDoc.zona,
      montoDiario: minimo.montoCentavos / 100,
      montoCentavos: minimo.montoCentavos,
      anio: minimo.anio,
      fuente: minimo.fuente,
      estado,
      municipio,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/salarios/pactado', async (req, res, next) => {
  try {
    const ctx = exigirUsuario(res.locals.claims);
    const body = z
      .object({
        membresiaId: z.string(),
        salarioDiario: z.number().positive(),
        jornadaHorasBase: z.number().positive().max(12),
        aceptadoPorColaborador: z.literal(true),
      })
      .parse(req.body);
    const membresia = await MembresiaModel.findOne({ _id: body.membresiaId, tenantId: ctx.tenantId }).lean<{
      sucursalId: string;
    } | null>();
    if (!membresia) throw new ApiError('Colaborador no encontrado', 'NO_ENCONTRADA', 404);
    const sucursal = await SucursalModel.findOne({ _id: membresia.sucursalId, tenantId: ctx.tenantId }).lean<{
      estado: string;
      municipio: string;
    } | null>();
    if (!sucursal) throw new ApiError('Sucursal no encontrada', 'NO_ENCONTRADA', 404);
    const zonaDoc = await MunicipioModel.findOne({ estado: sucursal.estado, municipio: sucursal.municipio }).lean<{
      zona: 'general' | 'zlfn';
    } | null>();
    if (!zonaDoc) throw new ApiError('Zona no catalogada', 'ZONA_NO_CATALOGADA', 422);
    const minimo = await MinimoModel.findOne({ anio: 2026, zona: zonaDoc.zona }).lean<{ montoCentavos: number } | null>();
    if (!minimo) throw new ApiError('Falta el mínimo vigente', 'PARAMETRO_FALTANTE', 422);
    const pactado = pesosACentavos(body.salarioDiario);
    if (pactado < minimo.montoCentavos) throw salarioBajoMinimo(minimo.montoCentavos);
    await PactadoModel.updateMany({ tenantId: ctx.tenantId, membresiaId: body.membresiaId, vigente: true }, { $set: { vigente: false } });
    await PactadoModel.create({
      tenantId: ctx.tenantId,
      membresiaId: body.membresiaId,
      salarioDiarioCentavos: pactado,
      jornadaHorasBase: body.jornadaHorasBase,
      minimoSnapshotCentavos: minimo.montoCentavos,
      zona: zonaDoc.zona,
      negociadoPor: ctx.membresiaId,
      fecha: new Date().toISOString(),
      aceptadoPorColaborador: true,
      vigente: true,
    });
    await MembresiaModel.updateOne({ _id: body.membresiaId, tenantId: ctx.tenantId }, { $set: { acuerdoVigente: true } });
    res.status(201).json({
      salarioDiario: pactado / 100,
      salarioHora: valorHoraCentavos(pactado, 'diurna') / 100,
      zona: zonaDoc.zona,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/salarios/pactado/:membresiaId/historial', async (req, res, next) => {
  try {
    const ctx = exigirUsuario(res.locals.claims);
    const items = await PactadoModel.find({ tenantId: ctx.tenantId, membresiaId: req.params.membresiaId }).sort({ fecha: -1 }).lean();
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.get('/sucursales', async (req, res, next) => {
  try {
    const ctx = exigirUsuario(res.locals.claims);
    const items = await SucursalModel.find({ tenantId: ctx.tenantId }).lean();
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/sucursales/:id/codigos-kiosko', async (req, res, next) => {
  try {
    const ctx = exigirUsuario(res.locals.claims);
    if (ctx.rol !== 'admin' && ctx.rol !== 'coach') throw new ApiError('Solo admin o coach', 'PROHIBIDO', 403);
    const sucursal = await SucursalModel.findOne({ _id: req.params.id, tenantId: ctx.tenantId }).lean();
    if (!sucursal) throw new ApiError('Sucursal no encontrada', 'NO_ENCONTRADA', 404);
    const codigo = randomBytes(4).toString('hex').slice(0, 8).toUpperCase();
    await CodigoKioskoModel.create({
      codigo,
      tenantId: ctx.tenantId,
      sucursalId: String(req.params.id),
      expira: new Date(Date.now() + 15 * 60 * 1000),
      usado: false,
    });
    res.status(201).json({ codigo, expiraEnMinutos: 15 });
  } catch (error) {
    next(error);
  }
});

router.post('/dispositivos/emparejar', async (req, res, next) => {
  try {
    const body = z
      .object({
        codigo: z.string().min(6),
        androidIdHash: z.string().min(8),
        modelo: z.string().default('android'),
        lat: z.number(),
        lng: z.number(),
      })
      .parse(req.body);
    const codigo = await CodigoKioskoModel.findOne({ codigo: body.codigo, usado: false }).lean<{
      tenantId: string;
      sucursalId: string;
      expira: Date;
    } | null>();
    if (!codigo || new Date(codigo.expira).getTime() < Date.now()) throw new ApiError('Código vencido o inválido', 'CODIGO_VENCIDO', 401);
    const sucursal = await SucursalModel.findOne({ _id: codigo.sucursalId, tenantId: codigo.tenantId }).lean<{
      lat: number;
      lng: number;
      radioMetros: number;
      nombre: string;
    } | null>();
    if (!sucursal) throw new ApiError('Sucursal no encontrada', 'NO_ENCONTRADA', 404);
    if (distanciaMetros(body.lat, body.lng, sucursal.lat, sucursal.lng) > sucursal.radioMetros) {
      throw new ApiError('El kiosko está fuera de la sucursal', 'FUERA_DE_GEOCERCA', 422);
    }
    const deviceId = randomUUID();
    await DispositivoModel.create({
      _id: deviceId,
      tenantId: codigo.tenantId,
      sucursalId: codigo.sucursalId,
      androidIdHash: body.androidIdHash,
      revocado: false,
      modelo: body.modelo,
    });
    await CodigoKioskoModel.updateOne({ codigo: body.codigo }, { $set: { usado: true } });
    const deviceToken = firmar(
      { typ: 'dispositivo', sub: deviceId, tenantId: codigo.tenantId, sucursalId: codigo.sucursalId, deviceId, rol: 'dispositivo' },
      60 * 60 * 24 * 365,
    );
    res.status(201).json({
      deviceId,
      deviceToken,
      tenantId: codigo.tenantId,
      sucursalId: codigo.sucursalId,
      sucursal: sucursal.nombre,
      geocerca: { lat: sucursal.lat, lng: sucursal.lng, radioMetros: sucursal.radioMetros },
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/dispositivos/sincronizacion', async (req, res, next) => {
  try {
    const device = exigirDispositivo(res.locals.claims);
    await assertDispositivoVivo(device);
    const empleados = await MembresiaModel.find({
      tenantId: device.tenantId,
      sucursalId: device.sucursalId,
      activa: true,
      acuerdoVigente: true,
      consentimientoFotoVigente: true,
    }).lean<Array<{ _id: string; nombre: string; pinHash: string; pinSalt: string; rol: string }>>();
    res.json({
      empleados: empleados.map((item) => ({
        id: item._id,
        nombre: item.nombre,
        pinHash: item.pinHash,
        salt: item.pinSalt,
        rol: item.rol,
        activo: true,
      })),
      config: { mostrarRecibo: true, registrarPausas: true, aviso: 'Registro electrónico acordado. La foto solo verifica asistencia.' },
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/dispositivos/checadas/lote', async (req, res, next) => {
  try {
    const device = exigirDispositivo(res.locals.claims);
    await assertDispositivoVivo(device);
    const body = z
      .object({
        checadas: z.array(checadaSchema).min(1).max(20),
      })
      .parse(req.body);
    const ultima = await ChecadaModel.findOne({ tenantId: device.tenantId, deviceId: device.deviceId }).sort({ seq: -1 }).lean<{
      seq: number;
      hashActual: string;
      _id: string;
    } | null>();
    let cursor = ultima ? { seq: ultima.seq, hashActual: ultima.hashActual } : null;
    const resultados = [];
    for (const entrada of body.checadas) {
      const previa = await ChecadaModel.findById(entrada.id).lean<{ _id: string } | null>();
      if (previa) {
        resultados.push({ id: entrada.id, estado: 'duplicada' as const });
        continue;
      }
      const evaluacion = evaluarChecada(cursor, { ...entrada, deviceId: device.deviceId });
      if (evaluacion.estado === 'rechazada') {
        resultados.push({ id: entrada.id, estado: 'rechazada' as const, motivo: evaluacion.motivo });
        continue;
      }
      const hoja: HojaChecada = {
        empleadoRef: entrada.empleadoId,
        tipo: entrada.tipo,
        ts: entrada.tsDispositivo,
        dispositivoId: device.deviceId,
        seq: entrada.seq,
        hashFoto: entrada.fotoSha256,
        salt: entrada.salt,
      };
      await ChecadaModel.create({
        _id: entrada.id,
        tenantId: device.tenantId,
        deviceId: device.deviceId,
        ...entrada,
        hojaMerkle: entrada.hojaMerkle || hojaMerkle(hoja),
      });
      cursor = { seq: entrada.seq, hashActual: entrada.hashActual };
      resultados.push({ id: entrada.id, estado: 'ok' as const });
    }
    res.json({ resultados, serverTime: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.post('/dispositivos/latido', async (req, res, next) => {
  try {
    const device = exigirDispositivo(res.locals.claims);
    await assertDispositivoVivo(device);
    res.json({ ok: true, serverTime: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.post('/dispositivos/ley-silla/reportes', async (req, res, next) => {
  try {
    const device = exigirDispositivo(res.locals.claims);
    const body = z.object({ id: z.string(), empleadoId: z.string(), motivo: z.string(), texto: z.string().default(''), ts: z.number() }).parse(req.body);
    await ReporteSillaModel.updateOne(
      { _id: body.id },
      { $setOnInsert: { ...body, tenantId: device.tenantId, deviceId: device.deviceId } },
      { upsert: true },
    );
    res.status(201).json({ id: body.id, estado: 'ok', serverTime: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

router.get('/dispositivos/ley-silla/config', async (req, res, next) => {
  try {
    const device = exigirDispositivo(res.locals.claims);
    const sucursal = await SucursalModel.findOne({ _id: device.sucursalId, tenantId: device.tenantId }).lean<{ avisoLeySilla: string } | null>();
    res.json({
      aviso: sucursal?.avisoLeySilla ?? 'Hay asientos con respaldo disponibles.',
      registrarPausas: true,
      fotoEnPausas: false,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/nomina/simular', (req, res, next) => {
  try {
    exigirUsuario(res.locals.claims);
    const body = z
      .object({
        horasPorDia: z.array(z.number().nonnegative()).min(1).max(7),
        jornadaDiaria: z.number().positive().default(8),
        tipoJornada: z.enum(['diurna', 'nocturna', 'mixta']).default('diurna'),
        salarioDiario: z.number().positive(),
        anio: z.number().default(2026),
      })
      .parse(req.body);
    const parametros = parametrosAnio(body.anio);
    const clasificacion = clasificarExtra(
      body.horasPorDia.map((horas) => ({ horasMilesimas: Math.round(horas * 1000), jornadaDiariaMilesimas: Math.round(body.jornadaDiaria * 1000) })),
      parametros,
    );
    const valor = valorHoraCentavos(pesosACentavos(body.salarioDiario), body.tipoJornada as TipoJornada);
    const pago = exencionTiempoExtra({
      doblesMilesimas: clasificacion.doblesMilesimas,
      triplesMilesimas: clasificacion.triplesMilesimas,
      valorHoraCentavos: valor,
      topeSemanalCentavos: TOPE_UMA_SEMANAL_2026_CENTAVOS,
      doblesExentables: !clasificacion.excedeHorasDia && !clasificacion.excedeDiasConExtra,
    });
    const sbc = integrarSbc({
      pagoDoblesCentavos: pago.pagoDoblesCentavos,
      pagoTriplesCentavos: pago.pagoTriplesCentavos,
      excedeLimites: clasificacion.excedeHorasDia || clasificacion.excedeDiasConExtra || clasificacion.excedeTopeAbsoluto,
    });
    res.json({
      versionParametros: `jornada-${body.anio}`,
      valorHora: valor / 100,
      clasificacion,
      pago: {
        dobles: pago.pagoDoblesCentavos / 100,
        triples: pago.pagoTriplesCentavos / 100,
        total: pago.pagoTotalCentavos / 100,
        exento: pago.exentoCentavos / 100,
        gravado: pago.gravadoCentavos / 100,
      },
      imss: {
        conservador: sbc.conservadorCentavos / 100,
        alterno: sbc.alternoCentavos / 100,
        diferencia: sbc.diferenciaCentavos / 100,
        criterio: 'Integra al SBC lo que rebase las horas dobles. El escenario alterno solo integra si se rebasan los límites.',
      },
      isr: { code: 'PARAMETRO_FALTANTE', mensaje: 'Falta la tarifa del ejercicio. No se inventa un ISR.' },
      semaforo: semaforoJornada(body.horasPorDia.reduce((sum, horas) => sum + horas, 0), parametros.jornadaOrdinariaSemanal),
      aviso: 'Cifras de jornada 2026-2030 marcadas como fuente secundaria en el paquete. Un contador debe verificarlas antes de nómina.',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/integridad/lotes', async (req, res, next) => {
  try {
    const ctx = exigirUsuario(res.locals.claims);
    const body = z.object({ fecha: z.string() }).parse(req.body);
    const inicio = new Date(`${body.fecha}T00:00:00.000Z`).getTime();
    const fin = inicio + 24 * 60 * 60 * 1000;
    const checadas = await ChecadaModel.find({
      tenantId: ctx.tenantId,
      tsDispositivo: { $gte: inicio, $lt: fin },
      hojaMerkle: { $ne: '' },
    })
      .sort({ deviceId: 1, seq: 1 })
      .lean<Array<{ hojaMerkle: string }>>();
    if (checadas.length === 0) throw new ApiError('No hay checadas íntegras ese día', 'SIN_HOJAS', 422);
    const arbol = armarArbol(checadas.map((item) => item.hojaMerkle));
    const loteId = randomUUID();
    await LoteModel.create({
      _id: loteId,
      tenantId: ctx.tenantId,
      fecha: body.fecha,
      raiz: arbol.raiz,
      nHojas: checadas.length,
      anclaje: 'LOCAL',
    });
    await AuditoriaModel.create({
      actor: ctx.membresiaId,
      accion: 'anclaje-local',
      detalle: `Raíz ${arbol.raiz} del ${body.fecha}. El sello externo (correo o OpenTimestamps) queda como puerto pendiente.`,
      en: new Date(),
    });
    res.status(201).json({ loteId, raiz: arbol.raiz, nHojas: checadas.length, anclaje: 'LOCAL' });
  } catch (error) {
    next(error);
  }
});

router.get('/integridad/lotes', async (req, res, next) => {
  try {
    const ctx = exigirUsuario(res.locals.claims);
    const items = await LoteModel.find({ tenantId: ctx.tenantId }).sort({ fecha: -1 }).limit(30).lean();
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

router.post('/superadmin/tenants', async (req, res, next) => {
  try {
    const clave = req.header('x-superadmin-key');
    if (!process.env.SUPERADMIN_KEY || clave !== process.env.SUPERADMIN_KEY) throw new ApiError('Sin permiso de superadmin', 'PROHIBIDO', 403);
    const body = z.object({ nombre: z.string().min(2) }).parse(req.body);
    const id = randomUUID();
    await TenantModel.create({ _id: id, nombre: body.nombre, activo: true });
    await AuditoriaModel.create({ actor: 'superadmin', accion: 'alta-tenant', detalle: id, en: new Date() });
    res.status(201).json({ id, nombre: body.nombre });
  } catch (error) {
    next(error);
  }
});

router.use((error: unknown, _req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }, _next: unknown) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: 'Revisa los datos enviados', code: 'VALIDATION' });
    return;
  }
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  console.error(error);
  res.status(500).json({ error: 'Error interno', code: 'INTERNAL' });
});

export const v1Router = router;

const checadaSchema = z.object({
  id: z.string().uuid(),
  seq: z.number().int().positive(),
  empleadoId: z.string(),
  tipo: z.string(),
  tsDispositivo: z.number(),
  offsetAplicado: z.number(),
  fotoSha256: z.string(),
  metodoIdentificacion: z.string(),
  huellaOsConfirmada: z.boolean(),
  hashPrev: z.string(),
  hashActual: z.string(),
  salt: z.string(),
  hojaMerkle: z.string(),
});

function exigirUsuario(claims: Claims | undefined): ClaimsUsuario {
  if (!claims || claims.typ !== 'usuario') throw new ApiError('Token de membresía requerido', 'NO_TENANT', 401);
  return claims;
}

function exigirDispositivo(claims: Claims | undefined): ClaimsDispositivo {
  if (!claims || claims.typ !== 'dispositivo') throw new ApiError('Token de dispositivo requerido', 'PROHIBIDO', 403);
  return claims;
}

async function assertDispositivoVivo(device: ClaimsDispositivo): Promise<void> {
  const doc = await DispositivoModel.findOne({ _id: device.deviceId, tenantId: device.tenantId, revocado: false }).lean();
  if (!doc) throw new ApiError('Dispositivo desvinculado', 'REVOCADO', 401);
}
