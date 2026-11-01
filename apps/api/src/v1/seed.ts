import { randomBytes } from 'node:crypto';
import { hashPin } from '@bizne/integridad';
import { pesosACentavos } from '@bizne/calculo';
import {
  CodigoKioskoModel,
  MembresiaModel,
  MinimoModel,
  MunicipioModel,
  PactadoModel,
  SucursalModel,
  TenantModel,
  UsuarioModel,
} from './models';

const TENANT = 'tenant-roma';
const ADMIN = 'usuario-admin';
const EMPLEADO = 'usuario-ana';
const MEM_ADMIN = 'mem-admin';
const MEM_ANA = 'mem-ana';
const SUCURSAL = 'suc-roma';

export async function seedReferencia(): Promise<void> {
  await MinimoModel.updateOne(
    { anio: 2026, zona: 'general' },
    {
      $setOnInsert: {
        anio: 2026,
        zona: 'general',
        montoCentavos: pesosACentavos(315.04),
        fuente: 'CONASAMI, vigente desde 2026-01-01. Confirmar resolución en gob.mx/conasami antes de producción.',
        vigenteDesde: '2026-01-01',
      },
    },
    { upsert: true },
  );
  await MinimoModel.updateOne(
    { anio: 2026, zona: 'zlfn' },
    {
      $setOnInsert: {
        anio: 2026,
        zona: 'zlfn',
        montoCentavos: pesosACentavos(440.87),
        fuente: 'CONASAMI zona libre de la frontera norte, vigente desde 2026-01-01.',
        vigenteDesde: '2026-01-01',
      },
    },
    { upsert: true },
  );

  const municipios = [
    { estado: 'Ciudad de México', municipio: 'Cuauhtémoc', zona: 'general' },
    { estado: 'Baja California', municipio: 'Tijuana', zona: 'zlfn' },
  ];
  for (const municipio of municipios) {
    await MunicipioModel.updateOne(municipio, { $setOnInsert: municipio }, { upsert: true });
  }

  const ya = await TenantModel.exists({ _id: TENANT });
  if (ya) return;

  const saltAna = randomBytes(8).toString('hex');
  const saltAdmin = randomBytes(8).toString('hex');
  await TenantModel.create({ _id: TENANT, nombre: 'Papelería Roma', activo: true });
  await UsuarioModel.create([
    { _id: ADMIN, telefono: '5512345678', nombre: 'Admin Roma', codigoAcceso: '246810' },
    { _id: EMPLEADO, telefono: '5587654321', nombre: 'Ana López', codigoAcceso: '135790' },
  ]);
  await SucursalModel.create({
    _id: SUCURSAL,
    tenantId: TENANT,
    nombre: 'Sucursal Roma',
    estado: 'Ciudad de México',
    municipio: 'Cuauhtémoc',
    lat: 19.4195,
    lng: -99.1619,
    radioMetros: 15_000,
    avisoLeySilla: 'Hay asientos con respaldo junto al área de empaque. La pausa no la vigila este kiosko.',
  });
  await MembresiaModel.create([
    {
      _id: MEM_ADMIN,
      tenantId: TENANT,
      usuarioId: ADMIN,
      rol: 'admin',
      sucursalId: SUCURSAL,
      activa: true,
      pinSalt: saltAdmin,
      pinHash: hashPin(saltAdmin, '9753'),
      acuerdoVigente: true,
      consentimientoFotoVigente: true,
      nombre: 'Admin Roma',
    },
    {
      _id: MEM_ANA,
      tenantId: TENANT,
      usuarioId: EMPLEADO,
      rol: 'empleado',
      sucursalId: SUCURSAL,
      activa: true,
      pinSalt: saltAna,
      pinHash: hashPin(saltAna, '2580'),
      acuerdoVigente: true,
      consentimientoFotoVigente: true,
      nombre: 'Ana López',
    },
  ]);
  await PactadoModel.create({
    tenantId: TENANT,
    membresiaId: MEM_ANA,
    salarioDiarioCentavos: pesosACentavos(400),
    jornadaHorasBase: 8,
    minimoSnapshotCentavos: pesosACentavos(315.04),
    zona: 'general',
    negociadoPor: MEM_ADMIN,
    fecha: new Date().toISOString(),
    aceptadoPorColaborador: true,
    vigente: true,
  });
  await CodigoKioskoModel.create({
    codigo: 'ROMADMO1',
    tenantId: TENANT,
    sucursalId: SUCURSAL,
    expira: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    usado: false,
  });
}
