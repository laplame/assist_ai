import { Schema, model } from 'mongoose';

const tenantSchema = new Schema(
  { _id: String, nombre: String, activo: { type: Boolean, default: true } },
  { versionKey: false },
);
const usuarioSchema = new Schema(
  { _id: String, telefono: { type: String, unique: true }, nombre: String, codigoAcceso: String },
  { versionKey: false },
);
const membresiaSchema = new Schema(
  {
    _id: String,
    tenantId: String,
    usuarioId: String,
    rol: String,
    sucursalId: String,
    activa: Boolean,
    pinSalt: String,
    pinHash: String,
    acuerdoVigente: Boolean,
    consentimientoFotoVigente: Boolean,
    nombre: String,
  },
  { versionKey: false },
);
membresiaSchema.index({ tenantId: 1, usuarioId: 1 });

const sucursalSchema = new Schema(
  {
    _id: String,
    tenantId: String,
    nombre: String,
    estado: String,
    municipio: String,
    lat: Number,
    lng: Number,
    radioMetros: Number,
    avisoLeySilla: String,
  },
  { versionKey: false },
);
sucursalSchema.index({ tenantId: 1 });

const minimoSchema = new Schema(
  { anio: Number, zona: String, montoCentavos: Number, fuente: String, vigenteDesde: String },
  { versionKey: false },
);
minimoSchema.index({ anio: 1, zona: 1 }, { unique: true });

const municipioSchema = new Schema(
  { estado: String, municipio: String, zona: String },
  { versionKey: false },
);
municipioSchema.index({ estado: 1, municipio: 1 }, { unique: true });

const pactadoSchema = new Schema(
  {
    tenantId: String,
    membresiaId: String,
    salarioDiarioCentavos: Number,
    jornadaHorasBase: Number,
    minimoSnapshotCentavos: Number,
    zona: String,
    negociadoPor: String,
    fecha: String,
    aceptadoPorColaborador: Boolean,
    vigente: Boolean,
  },
  { versionKey: false, timestamps: true },
);
pactadoSchema.index({ tenantId: 1, membresiaId: 1, vigente: 1 });

const codigoSchema = new Schema(
  { codigo: { type: String, unique: true }, tenantId: String, sucursalId: String, expira: Date, usado: Boolean },
  { versionKey: false },
);

const dispositivoSchema = new Schema(
  { _id: String, tenantId: String, sucursalId: String, androidIdHash: String, revocado: Boolean, modelo: String },
  { versionKey: false },
);

const checadaSchema = new Schema(
  {
    _id: String,
    tenantId: String,
    deviceId: String,
    seq: Number,
    empleadoId: String,
    tipo: String,
    tsDispositivo: Number,
    offsetAplicado: Number,
    fotoSha256: String,
    metodoIdentificacion: String,
    huellaOsConfirmada: Boolean,
    hashPrev: String,
    hashActual: String,
    salt: String,
    hojaMerkle: String,
    fotoBase64: String,
    anomalia: String,
  },
  { versionKey: false },
);
checadaSchema.index({ tenantId: 1, deviceId: 1, seq: 1 });

const loteSchema = new Schema(
  { _id: String, tenantId: String, fecha: String, raiz: String, nHojas: Number, anclaje: String },
  { versionKey: false },
);

const auditoriaSchema = new Schema(
  { actor: String, accion: String, detalle: String, en: Date },
  { versionKey: false },
);

const reporteSchema = new Schema(
  { _id: String, tenantId: String, deviceId: String, empleadoId: String, motivo: String, texto: String, ts: Number },
  { versionKey: false },
);

export const TenantModel = model('Tenant', tenantSchema, 'tenants');
export const UsuarioModel = model('Usuario', usuarioSchema, 'usuarios');
export const MembresiaModel = model('Membresia', membresiaSchema, 'membresias');
export const SucursalModel = model('Sucursal', sucursalSchema, 'sucursales');
export const MinimoModel = model('SalarioMinimo', minimoSchema, 'salarios_minimos');
export const MunicipioModel = model('MunicipioZona', municipioSchema, 'municipios_zona');
export const PactadoModel = model('SalarioPactado', pactadoSchema, 'salarios_pactados');
export const CodigoKioskoModel = model('CodigoKiosko', codigoSchema, 'codigos_kiosko');
export const DispositivoModel = model('Dispositivo', dispositivoSchema, 'dispositivos');
export const ChecadaModel = model('Checada', checadaSchema, 'checadas');
export const LoteModel = model('LoteMerkle', loteSchema, 'lotes_merkle');
export const AuditoriaModel = model('Auditoria', auditoriaSchema, 'auditoria');
export const ReporteSillaModel = model('ReporteSilla', reporteSchema, 'reportes_ley_silla');
