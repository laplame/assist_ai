# Paquete de prompts — Sistema de asistencia GPS + biometría para PyMEs en México

> Un solo archivo con todos los prompts en el orden de construcción, el prompt del flyer y los *features* (Gherkin).
> Revisión legal: 31-oct-2026. **No es asesoría legal**: todo debe validarlo un abogado laboral y un contador antes de producción.
> Etiquetas usadas en las partes legales: **[LEY]** texto leído · **[FUENTE]** reporte sin cotejar con el DOF · **[PENDIENTE]** sin confirmar.

## Contenido

1. Salario mínimo y salario pactado (API + Expo)
2. Arquitectura hexagonal multi-tenant (backend, rutas, clientes)
3. Kiosko de asistencia en Android viejo (Expo) · marco legal y Ley Silla
4. Dashboard web: tiempo extra, SAT, IMSS y STPS
5. Integridad verificable: Merkle + ZK y reparto Android / Web
6. Prompt del flyer de Instagram (ElevenLabs) y texto del post
7. Apéndice: *features* (Gherkin) del sistema de asistencia

**Orden sugerido de construcción:** 1 → 2 → 3 → 4 → 5. El flyer (6) es independiente. Los *features* (7) se usan como pruebas de aceptación; los escenarios adicionales ya están dentro de las partes 3, 4 y 5.

---

# PARTE 1 — Salario mínimo y salario pactado (API + Expo)

<!-- origen: prompt-salario-negociado-expo.md -->

# Prompt: API de salario mínimo sugerido + negociación de salario pactado (Expo)

> Copia este documento completo como prompt para tu agente de desarrollo (Claude Code u otro).
> Da contexto suficiente para que pueda scaffoldear backend + app Expo sin preguntas adicionales,
> pero deja marcadas las decisiones que sí requieren que un humano las confirme antes de producción.

## 1. Contexto del producto

Estamos construyendo el módulo de asistencia y turnos de **BizneAI** (sistema de checado GPS +
biometría facial para PyMEs mexicanas, ya prototipado en React/Tailwind — ver
`asistencia-gps-ux.jsx` — y su versión HTML/CSS de referencia visual `asistencia-mockup.html`,
además del contrato funcional en `asistencia-biometrica-gps.feature`).

Ese módulo ya calcula nómina semanal (horas ordinarias, dobles, triples, prima dominical,
descanso trabajado — Art. 66-68 y 71 LFT) a partir de un `salarioHora` y `salarioDiario` por
colaborador. Hoy esos dos valores se capturan a mano. Este prompt construye la pieza que falta:
**de dónde sale ese salario y cómo queda documentado que patrón y colaborador lo acordaron.**

## 2. Objetivo funcional

1. Al dar de alta a un colaborador (o editar su salario), el sistema **sugiere** el salario
   mínimo vigente que le corresponde según la zona geográfica de su sucursal.
2. El administrador **negocia** con el colaborador un salario pactado, que debe ser **mayor o
   igual** al mínimo sugerido — nunca menor.
3. Ese salario pactado, junto con la fecha y quién lo capturó, queda **registrado como acuerdo**
   (mismo espíritu que el registro de asistencia: evidencia que protege a ambas partes).
4. El salario pactado alimenta directamente el cálculo de nómina existente
   (`calcularNomina()`), reemplazando los valores capturados a mano.

## 3. Dato importante sobre la fuente del salario mínimo

**CONASAMI no publica una API pública en tiempo real.** El salario mínimo se fija una vez al año
mediante resolución publicada en el Diario Oficial de la Federación (normalmente en diciembre,
vigente desde el 1 de enero siguiente). Por lo tanto:

- La "API" que construimos aquí es **nuestra propia API interna**, respaldada por una tabla de
  referencia que se actualiza manualmente (o por un job anual) cuando sale la resolución de la
  CONASAMI — no un fetch a una fuente externa en vivo.
- Referencia para 2026 (CONASAMI, DOF, vigente desde el 1 de enero de 2026):
  - Salario mínimo general: **$315.04 MXN/día**
  - Zona Libre de la Frontera Norte (ZLFN): **$440.87 MXN/día**
  - Existen además 61 salarios mínimos profesionales por oficio (mismo % de incremento por
    zona) — **fuera de alcance de la v1**, dejar el modelo de datos preparado para agregarlos
    después.
- La ZLFN cubre 45 municipios específicos de 6 estados (Baja California, Sonora, Chihuahua,
  Coahuila, Nuevo León, Tamaulipas) — **no el estado completo**. Antes de sembrar la tabla de
  municipios en producción, verificar la lista completa y vigente contra
  `https://www.gob.mx/conasami` — no la reproduzcas de memoria ni de una fuente secundaria.
- Deja el `anio` como parte de la clave primaria de la tabla de salarios mínimos, para poder
  guardar el histórico y no perder trazabilidad cuando cambie cada enero.

## 4. Modelo de datos

```ts
// Tabla de referencia — se actualiza una vez al año, no por transacción
interface SalarioMinimoVigente {
  anio: number;                 // p.ej. 2026
  zona: "general" | "zlfn";
  montoDiario: number;          // MXN
  fuente: string;                // URL o referencia a la resolución CONASAMI/DOF
  vigenteDesde: string;          // ISO date, normalmente 1 de enero
}

// Municipio -> zona, para resolver automáticamente desde la sucursal
interface MunicipioZona {
  estado: string;
  municipio: string;
  zona: "general" | "zlfn";
}

// Fase 2 (dejar el tipo listo, no implementar aún)
interface SalarioMinimoProfesional {
  anio: number;
  zona: "general" | "zlfn";
  oficio: string;                // una de las 61 profesiones/oficios CONASAMI
  montoDiario: number;
}

// El acuerdo negociado con cada colaborador
interface SalarioPactado {
  colaboradorId: string;
  salarioDiario: number;
  jornadaHorasBase: number;       // para derivar salarioHora = salarioDiario / jornadaHorasBase
  salarioMinimoSugeridoAlMomento: number; // snapshot del mínimo vigente cuando se pactó
  zona: "general" | "zlfn";
  negociadoPor: string;           // userId del admin/coach que lo capturó
  fecha: string;                  // ISO datetime
  aceptadoPorColaborador: boolean; // el colaborador debe confirmar, igual que el consentimiento de biometría
  vigente: boolean;                // false cuando se reemplaza por un nuevo acuerdo (se conserva el histórico, nunca se borra)
}
```

## 5. Endpoints de la API

Backend recomendado: Node.js + Express (o Fastify) + MongoDB/Mongoose, para mantener
consistencia con el stack ya usado en DameCodigo. Prefijo sugerido: `/api/salarios`.

```
GET  /api/salarios/minimo?municipio=Tijuana&estado=Baja California&anio=2026
     → { zona: "zlfn", montoDiario: 440.87, anio: 2026, fuente: "..." }

GET  /api/salarios/minimo?sucursalId=roma
     → resuelve municipio/estado de la sucursal internamente y regresa lo mismo que arriba

POST /api/salarios/pactado
     body: { colaboradorId, salarioDiario, jornadaHorasBase, negociadoPor, aceptadoPorColaborador }
     → valida salarioDiario >= salarioMinimoVigente de la zona de su sucursal
     → 422 si es menor, con el mensaje "El salario pactado no puede ser menor al mínimo vigente ($X.XX)"
     → si es válido, marca el acuerdo anterior vigente=false y crea el nuevo registro

GET  /api/salarios/pactado/:colaboradorId
     → regresa el acuerdo vigente actual + historial (para auditoría)

GET  /api/salarios/pactado/:colaboradorId/historial
     → lista completa de acuerdos, incluyendo los reemplazados
```

Todas las respuestas de error deben usar un formato consistente:
`{ error: string, code: string }` — el cliente Expo lo usa para mostrar el mensaje correcto en
el formulario de negociación sin tener que parsear texto libre.

## 6. Flujo en la app (dónde vive en la UI ya construida)

Se integra en el **paso "Datos" del alta de colaborador** (`ColaboradorForm`, ver
`asistencia-gps-ux.jsx`), agregando un sub-paso de negociación salarial antes del paso de
biometría:

1. El admin captura o confirma la sucursal del colaborador (ya existe en el paso 3 actual —
   puede que convenga mover sucursal antes que salario, o resolver zona por la primera sucursal
   seleccionada).
2. La app llama `GET /api/salarios/minimo?sucursalId=...` y muestra: *"Salario mínimo sugerido
   para esta zona: $X.XX/día"*.
3. Campo editable "Salario diario pactado", prellenado con el mínimo sugerido pero editable
   hacia arriba. Si el admin intenta guardar un monto menor, el campo se marca en rojo con el
   mensaje que regresa la API — no se permite continuar.
4. Checkbox/confirmación: *"El colaborador acepta este salario"* — igual de obligatorio que el
   enrolamiento biométrico; sin esto no se puede guardar (mismo patrón que ya usamos con la
   biometría: paso bloqueante, no opcional).
5. Al guardar, `POST /api/salarios/pactado` — y esos valores (`salarioDiario`,
   `salarioDiario / jornadaHorasBase`) son los que de ahora en adelante alimentan
   `calcularNomina()` en vez de los datos de ejemplo hardcodeados en `NOMINA`.
6. En la pantalla de **Nómina**, agregar un ícono/link "Ver acuerdo salarial" por colaborador
   que abra el historial (`GET /api/salarios/pactado/:id/historial`) — refuerza la misma lógica
   de "registro que no se puede alterar después" que ya aplicamos al comprobante de asistencia.

## 7. Validaciones de negocio

- `salarioDiario >= salarioMinimoVigente` de la zona — bloqueante, no solo advertencia.
- Un colaborador siempre tiene exactamente un acuerdo `vigente: true`; renegociar crea uno nuevo
  y marca el anterior como histórico, nunca se sobreescribe ni se borra.
- Si cambia de sucursal a una zona distinta (general ↔ ZLFN), el sistema debe **recalcular** el
  mínimo sugerido para la nueva zona y avisar si el salario pactado actual queda por debajo —
  no ajusta el salario automáticamente, solo alerta al admin.
- Cuando cambie el año (nuevo salario mínimo vigente cada enero), los acuerdos existentes siguen
  siendo válidos aunque el mínimo suba — pero el sistema debe señalar en el dashboard qué
  colaboradores quedaron por debajo del nuevo mínimo, para que el admin actualice antes de que
  sea un incumplimiento.

## 8. Estructura de carpetas sugerida (monorepo simple)

```
/api
  /src
    /models        (SalarioMinimoVigente.js, MunicipioZona.js, SalarioPactado.js)
    /routes         (salarios.routes.js)
    /services       (resolverZona.js, validarSalarioMinimo.js)
    /seeds          (salarios-minimos-2026.json, municipios-zlfn.json)
/app  (Expo)
  /app
    /(admin)/colaboradores/alta.tsx
    /(admin)/nomina/[colaboradorId]/acuerdo.tsx
  /features
    /salarios
      api.ts          (funciones fetch tipadas hacia /api/salarios/*)
      useSalarioMinimo.ts   (hook con TanStack Query)
      useSalarioPactado.ts
      SalarioNegociacionForm.tsx
  /shared
    /theme            (tokens ya definidos: --bg-void, --indigo, --mint, --amber, etc.)
```

## 9. Dependencias necesarias

### Backend (`/api`)
```bash
npm install express mongoose zod dotenv cors
npm install -D nodemon
```
- `zod` para validar el body de `POST /api/salarios/pactado` antes de tocar la base de datos.
- `mongoose` consistente con el resto del stack (DameCodigo ya usa MongoDB).

### App Expo (`/app`)
```bash
npx expo install expo-router expo-secure-store
npm install @tanstack/react-query zod
npm install axios
```
- `@tanstack/react-query`: cachea `GET /api/salarios/minimo` (cambia una vez al año, no hace
  falta refetch agresivo — `staleTime` largo) y maneja el estado de mutación de
  `POST /api/salarios/pactado` con estados de carga/error listos para la UI.
- `zod`: valida el formulario de negociación en el cliente antes de pegarle a la API (evita un
  roundtrip solo para descubrir que el salario es menor al mínimo).
- `axios`: cliente HTTP; alternativa válida es `fetch` nativo si prefieren no sumar dependencia.
- `expo-secure-store`: si el token de sesión del admin se maneja localmente en el dispositivo.

No se requiere `expo-location` ni librerías de geolocalización para esta pieza — eso ya lo
resuelve el módulo de check-in; aquí solo se **lee** la sucursal ya asignada al colaborador.

## 10. Variables de entorno

```
# /api/.env
MONGODB_URI=
PORT=4000

# /app/.env
EXPO_PUBLIC_API_URL=https://tu-api.bizneai.com
```

## 11. Fuera de alcance de esta v1 (decirlo explícitamente para no scope-creep)

- Salarios mínimos profesionales por oficio (las 61 profesiones CONASAMI) — el modelo de datos
  ya los contempla, pero la sugerencia v1 solo resuelve general vs. ZLFN.
- Cálculo de ISR/IMSS sobre el salario pactado — la app de nómina ya construida calcula el pago
  bruto (ordinario + extra + modificadores); retenciones fiscales quedan fuera de este prompt.
- Actualización automática vía scraping o API de CONASAMI — no existe una API pública oficial;
  la tabla se actualiza manualmente (o con un job programado) cuando sale la resolución de
  diciembre.
- Firma electrónica avanzada del acuerdo salarial — por ahora el checkbox de aceptación +
  timestamp + usuario que lo capturó es suficiente para el alcance de este prompt; si más
  adelante se necesita valor probatorio reforzado, revisar junto con el mismo criterio que ya
  aplicamos al registro de asistencia (Art. 132 fr. XXXIV LFT: debe estar "acordado" entre
  trabajador y patrón).

## 12. Criterios de aceptación

- [ ] `GET /api/salarios/minimo` resuelve correctamente zona por sucursal y por municipio/estado
      capturados a mano.
- [ ] `POST /api/salarios/pactado` rechaza con 422 cualquier salario por debajo del mínimo
      vigente de la zona correspondiente.
- [ ] El formulario de alta de colaborador no permite avanzar al paso de biometría sin un
      acuerdo salarial válido y aceptado.
- [ ] `calcularNomina()` en el cliente Expo consume `salarioPactado.salarioDiario` real, no un
      valor hardcodeado.
- [ ] Cambiar de sucursal a otra zona dispara la alerta de "salario por debajo del nuevo mínimo"
      cuando corresponda, sin autoajustar el monto.
- [ ] Existe un histórico consultable de acuerdos por colaborador (nunca se sobreescribe un
      registro pasado).

---

# PARTE 2 — Arquitectura hexagonal multi-tenant (backend, rutas, clientes)

<!-- origen: prompt-arquitectura-hexagonal-multitenant.md -->

# Prompt: Arquitectura hexagonal multi-tenant — backend, rutas API y clientes

> Copia este documento completo como prompt para tu agente de desarrollo (Claude Code u otro).
> Este prompt **reestructura** el backend que soporta todo lo ya prototipado (asistencia GPS +
> biometría, sucursales, turnos, validación del coach, nómina y negociación salarial — ver
> `asistencia-gps-ux.jsx`, `asistencia-mockup.html`, `asistencia-biometrica-gps.feature` y
> `prompt-salario-negociado-expo.md`) para que un mismo backend sirva a **múltiples negocios
> (tenants)** de forma aislada, con arquitectura de puertos y adaptadores (hexagonal).

## 1. Por qué hexagonal + multi-tenant juntos

Cada regla de negocio que ya definimos (geocerca, biometría, jornadas LFT, cálculo de horas
extra, salario mínimo por zona) es lógica de dominio pura — no debería importarle si corre para
la Papelería Express o para el negocio número 200 que se dé de alta en BizneAI. Arquitectura
hexagonal separa esa lógica de:

- **Cómo llega la petición** (Expo app, panel web, backoffice interno) → adaptadores de entrada
- **Dónde se guarda el dato** (MongoDB hoy, lo que sea mañana) → adaptadores de salida
- **De qué tenant es el dato** → una capa transversal que nunca debe tocar la lógica de dominio

Si el dominio depende directamente de Mongoose o de un `tenantId` regado por todos lados, cada
cliente nuevo (panel web, backoffice) obliga a tocar reglas de negocio ya probadas. Con puertos
e inversión de dependencias, un cliente nuevo es solo un adaptador de entrada más.

## 2. Decisión de aislamiento de datos (a confirmar, pero con recomendación)

Dos estrategias válidas:

| Estrategia | Ventaja | Costo |
|---|---|---|
| **DB compartida + `tenantId` en cada colección** | Barata, fácil de escalar a cientos de PyMEs pequeñas, migraciones simples | Requiere disciplina absoluta para nunca olvidar el filtro |
| **Base de datos por tenant** | Aislamiento total, más fácil de justificar ante auditoría | Cara operativamente para el volumen de PyMEs que maneja BizneAI |

**Recomendación:** empezar con DB compartida + `tenantId`, pero con el filtro **forzado a nivel
de repositorio** (ver sección 5), no a nivel de query individual — así, si más adelante un
cliente grande exige base aislada, solo se cambia el adaptador de persistencia de ese tenant, no
la lógica de dominio ni los casos de uso.

## 3. Modelado de identidad — importante antes de tocar código

Un colaborador puede trabajar para más de un negocio (ej. alguien que cubre turnos en dos PyMEs
distintas). Por eso separamos:

- **`Usuario`**: identidad global de login (teléfono/WhatsApp, biometría enrolada). No pertenece
  a ningún tenant.
- **`Membresia`**: la relación `usuarioId + tenantId + rol` (empleado/coach/admin) +
  `sucursalesAsignadas`. Un usuario puede tener varias membresías, una por tenant.
- El **salario pactado**, las **sucursales asignadas** y el **historial de asistencia** cuelgan
  de la `Membresia`, no del `Usuario` — son datos de la relación laboral con ESE tenant
  específico, no de la persona en abstracto.

```ts
interface Usuario {
  id: string;
  telefono: string;           // identidad de login, único global
  nombre: string;
  biometriaEnrolada: boolean; // el enrolamiento facial es de la persona, no del tenant
}

interface Membresia {
  id: string;
  tenantId: string;
  usuarioId: string;
  rol: "empleado" | "coach" | "admin";
  sucursalesAsignadas: string[];
  activa: boolean;
}
```

El JWT que se emite después de login incluye `usuarioId`, `tenantId` y `membresiaId` del tenant
que el usuario eligió operar (igual que cambiar de workspace en Slack) — no se emite un token
"global" que abarque todos sus tenants a la vez.

## 4. Estructura de carpetas (backend, por bounded context)

```
/api
  /src
    /modules
      /tenancy        # alta de negocios, suspensión, plan/límites
      /identidad       # Usuario, Membresia, login (WhatsApp OTP vía Twilio, ya usado en Link4Deal)
      /sucursales      # geocercas, Ley Silla
      /turnos          # jornadas LFT, tope semanal
      /asistencia      # check-in GPS + biometría, comprobante
      /validacion      # cola del coach, casos especiales
      /nomina          # salario pactado, cálculo de horas extra y modificadores
      /catalogos       # salario mínimo CONASAMI, municipios-zona — GLOBAL, no tenant-scoped
    /shared
      /tenant-context  # middleware + AsyncLocalStorage
      /auth            # JWT, guards de rol
      /di              # wiring de puertos -> adaptadores por módulo
      /http            # bootstrap de Express, manejo de errores
    server.ts

/clients
  /expo-app            # colaborador / coach / admin — ya prototipado
  /admin-web           # fase 2 — panel de escritorio para cuentas grandes (Next.js)
  /superadmin-web       # fase 2 — backoffice interno de BizneAI (alta de tenants, métricas)
```

Cada módulo sigue el mismo patrón interno:

```
/modules/asistencia
  /domain
    RegistroAsistencia.ts        # entidad
    ComprobanteBiometrico.ts     # value object
    ports/
      AsistenciaRepository.ts    # puerto de salida (interfaz)
  /application
    RegistrarEntrada.usecase.ts  # puerto de entrada — orquesta dominio + puertos de salida
    RegistrarSalida.usecase.ts
    ResolverSucursalPorGeocerca.usecase.ts
  /infrastructure
    /http
      asistencia.routes.ts
      asistencia.controller.ts   # adaptador de entrada — traduce HTTP a llamada de caso de uso
    /persistence
      AsistenciaRepositoryMongo.ts  # adaptador de salida — implementa el puerto
```

## 5. El patrón puerto/adaptador, con ejemplo concreto

```ts
// domain/ports/AsistenciaRepository.ts — el dominio SOLO conoce esta interfaz
export interface AsistenciaRepository {
  guardar(registro: RegistroAsistencia): Promise<void>;
  buscarPorColaboradorYSemana(membresiaId: string, semana: string): Promise<RegistroAsistencia[]>;
}

// application/RegistrarEntrada.usecase.ts — no importa Mongoose, no importa Express
export class RegistrarEntradaUseCase {
  constructor(private readonly repo: AsistenciaRepository) {}

  async ejecutar(input: RegistrarEntradaInput): Promise<RegistroAsistencia> {
    // reglas de negocio puras: geocerca, biometría, comprobante — sin tocar infraestructura
  }
}

// infrastructure/persistence/AsistenciaRepositoryMongo.ts — el ÚNICO lugar que sabe de tenantId
export class AsistenciaRepositoryMongo implements AsistenciaRepository {
  constructor(private readonly tenantId: string) {}   // inyectado por request, nunca opcional

  async guardar(registro: RegistroAsistencia) {
    await AsistenciaModel.create({ ...registro, tenantId: this.tenantId });
  }

  async buscarPorColaboradorYSemana(membresiaId: string, semana: string) {
    return AsistenciaModel.find({ tenantId: this.tenantId, membresiaId, semana });
  }
}
```

**Regla no negociable:** ningún adaptador de persistencia se instancia sin `tenantId`. El
constructor lo exige — no hay forma de construir el repositorio "olvidando" el filtro. La
inyección de ese `tenantId` pasa por el middleware descrito en la sección 6, nunca por un
parámetro que el desarrollador tenga que acordarse de pasar a mano en cada query.

El módulo `catalogos` (salario mínimo, municipios-zona) es la única excepción: sus repositorios
**no** reciben `tenantId` porque son datos de referencia nacional, compartidos por todos los
tenants — documentarlo así explícitamente para que nadie lo "corrija" después por inercia.

## 6. Middleware de contexto de tenant

```ts
// shared/tenant-context/tenantContext.ts
import { AsyncLocalStorage } from "node:async_hooks";

interface TenantContext { tenantId: string; usuarioId: string; rol: string; membresiaId: string; }
export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

// shared/auth/tenantMiddleware.ts
export function tenantMiddleware(req, res, next) {
  const claims = verificarJWT(req.headers.authorization); // tenantId, usuarioId, rol, membresiaId
  if (!claims?.tenantId) return res.status(401).json({ error: "Token sin tenant", code: "NO_TENANT" });
  tenantContextStorage.run(claims, () => next());
}

// shared/di/container.ts — cómo un controlador obtiene un repositorio ya "amarrado" al tenant
export function asistenciaRepository(): AsistenciaRepository {
  const ctx = tenantContextStorage.getStore();
  if (!ctx) throw new Error("Repositorio solicitado fuera de contexto de tenant");
  return new AsistenciaRepositoryMongo(ctx.tenantId);
}
```

Con esto, un caso de uso o controlador nunca recibe ni pasa `tenantId` manualmente — lo obtiene
el contenedor de dependencias desde el contexto de la petición actual. Elimina la clase de bug
más común en SaaS multi-tenant: una query que se le olvidó el filtro y expone datos de un
negocio a otro.

## 7. Rutas API

Prefijo `/api/v1`. El tenant se resuelve **desde el JWT**, no desde subdominio ni desde la URL —
la app Expo no tiene subdominios, y así el mismo esquema sirve para todos los clientes por
igual.

```
POST /api/v1/auth/login                    (WhatsApp OTP — reutiliza el flujo Twilio de Link4Deal)
POST /api/v1/auth/seleccionar-tenant        (si el usuario tiene varias membresías, elige una y recibe el JWT con tenantId)

GET  /api/v1/sucursales
POST /api/v1/sucursales
GET  /api/v1/sucursales/:id/diagnostico-ley-silla
POST /api/v1/sucursales/:id/diagnostico-ley-silla

GET  /api/v1/turnos
POST /api/v1/turnos

POST /api/v1/asistencia/entrada
POST /api/v1/asistencia/salida
GET  /api/v1/asistencia/:membresiaId/hoy

GET  /api/v1/validacion/pendientes
POST /api/v1/validacion/:casoId/resolver

GET  /api/v1/salarios/minimo?sucursalId=...      (módulo catalogos — sin tenantId en la query, pero sigue requiriendo JWT válido)
POST /api/v1/salarios/pactado
GET  /api/v1/salarios/pactado/:membresiaId/historial

GET  /api/v1/nomina/semana/:fecha
GET  /api/v1/nomina/exportar/:fecha

# Namespace separado, rol distinto, siempre auditado
POST /api/v1/superadmin/tenants
GET  /api/v1/superadmin/tenants/:id/metricas
```

Las rutas bajo `/superadmin` viven en su propio router con su propio middleware
(`superadminMiddleware`, no `tenantMiddleware`) y **cada acceso se registra en un log de
auditoría append-only** — es la única parte del sistema que cruza el límite de tenant a
propósito, así que necesita trazabilidad reforzada, no menos.

## 8. Clientes (adaptadores de entrada, fuera del backend)

| Cliente | Quién lo usa | Estado |
|---|---|---|
| **App Expo** (`/clients/expo-app`) | Empleado, coach, admin de un negocio — ya prototipado en `asistencia-gps-ux.jsx` | Migrar a consumir la API real vía React Query, reemplazando los datos hardcodeados |
| **Panel web admin** (`/clients/admin-web`) | Dueños/RH de cuentas más grandes que prefieren escritorio para nómina y reportes | Fase 2 — mismos casos de uso, adaptador de entrada nuevo, cero cambios en `/domain` ni `/application` |
| **Backoffice interno** (`/clients/superadmin-web`) | Equipo de BizneAI: alta de tenants, soporte, métricas cross-tenant | Fase 2 — es el único cliente con permiso de ver más de un tenant a la vez |

Ningún cliente habla directo con MongoDB ni con los casos de uso en proceso — todos pasan por
`/api/v1` sobre HTTP, incluida la propia app Expo. Esto es lo que hace que agregar el panel web
en fase 2 no sea una reescritura: es un cliente HTTP más contra la misma API.

## 9. Dependencias

### Backend (`/api`)
```bash
npm install express mongoose zod dotenv cors jsonwebtoken helmet pino pino-http
npm install -D nodemon typescript ts-node @types/express @types/jsonwebtoken
```
- `jsonwebtoken`: emisión/verificación del JWT con `tenantId` + `membresiaId` + `rol`.
- `pino` + `pino-http`: logging estructurado — cada línea de log debe incluir `tenantId`
  automáticamente (child logger por request), indispensable para depurar en multi-tenant.
- `helmet`, `cors`: hardening estándar de Express.
- `AsyncLocalStorage` es parte de Node.js — no requiere dependencia.

### Clientes Expo (`/clients/expo-app`)
Mismas dependencias ya definidas en `prompt-salario-negociado-expo.md`
(`@tanstack/react-query`, `zod`, `axios`, `expo-secure-store`), agregando:
```bash
npm install jwt-decode
```
para leer `tenantId`/`rol` del token en el cliente y decidir qué pantallas mostrar (empleado vs.
coach vs. admin) sin esperar respuesta del servidor.

## 10. Migración de lo ya prototipado

- Todas las colecciones de los módulos `sucursales`, `turnos`, `asistencia`, `validacion` y
  `nomina` requieren un campo `tenantId` indexado (`{ tenantId: 1, ... }` como índice compuesto
  en cada query frecuente).
- Los datos de ejemplo usados en los mockups (`SUCURSALES`, `COLABORADORES`, `NOMINA` en
  `asistencia-gps-ux.jsx`) pasan a ser resultado de `GET` reales contra `/api/v1`, filtrados por
  el `tenantId` del JWT — no requieren cambios de UI, solo de origen de datos.
- `SalarioMinimoVigente` y `MunicipioZona` (del prompt anterior) se quedan en el módulo
  `catalogos`, confirmando que nunca llevan `tenantId`.

## 11. Criterios de aceptación

- [ ] Ningún adaptador de persistencia (excepto `catalogos`) puede instanciarse sin `tenantId`.
- [ ] Una petición sin JWT válido o sin `tenantId` en el claim recibe 401 antes de tocar
      cualquier caso de uso.
- [ ] Un usuario con membresías en dos tenants puede cambiar de tenant sin cerrar sesión por
      completo — reemitiendo el JWT vía `/auth/seleccionar-tenant`.
- [ ] Existe al menos una prueba automatizada que confirme que una query hecha con el
      `tenantId` de un negocio nunca regresa documentos de otro.
- [ ] Las rutas `/superadmin/*` quedan fuera del alcance de cualquier rol que no sea
      `superadmin`, y cada request a esas rutas se audita.
- [ ] Agregar `admin-web` como cliente nuevo en fase 2 no requiere modificar ningún archivo
      dentro de `/domain` o `/application` de ningún módulo.

---

# PARTE 3 — Kiosko de asistencia en Android viejo (Expo) · marco legal y Ley Silla

<!-- origen: prompt-kiosko-asistencia-expo.md -->

# Prompt: App Expo "BizneAI Kiosko" — convierte un Android viejo en un checador de asistencia

> Copia este documento completo como prompt para tu agente de desarrollo (Claude Code u otro).
> Es una app **nueva, desde cero**, independiente de la app de colaboradores/coach/admin ya
> prototipada. Se conecta al mismo backend multi-tenant hexagonal (ver
> `prompt-arquitectura-hexagonal-multitenant.md`) como un cliente más, con un tipo de
> identidad nuevo: el **dispositivo**.

---

## 1. Objetivo

Que un negocio pueda tomar un celular Android que ya tiene (viejo, de bajos recursos, sin Play
Store si hace falta) y dejarlo fijo en la sucursal como **checador de asistencia**:

1. El colaborador se **identifica** (PIN o QR de credencial).
2. Se toma una **foto** (selfie) como evidencia de quién checó.
3. Opcionalmente se pide **huella** del sensor del propio celular (ver sección 2: qué prueba y
   qué NO prueba).
4. La checada se guarda **offline primero** y se **sincroniza** con el backend cuando hay red.

Meta de negocio: no obligar al dueño a comprar hardware nuevo, y que el registro siga siendo
útil como evidencia ante una inspección o juicio laboral (Art. 132 fr. XXXIV LFT: el mecanismo
electrónico debe estar acordado entre trabajador y patrón).

## 2. Limitación técnica que condiciona el diseño — leer antes de escribir código

**La huella del sensor de un celular Android NO sirve para identificar a cada empleado.**
`expo-local-authentication` usa el BiometricPrompt del sistema operativo: responde únicamente
"sí/no, alguien con una huella registrada en este celular tocó el sensor". La app **nunca recibe
la plantilla de la huella ni sabe de quién fue**. Si metes las huellas de 10 empleados en los
ajustes del celular, el sistema no puede decir cuál de los 10 fue. Además, quien tenga una huella
registrada en el celular también podría desbloquear el modo admin.

Por eso este prompt define **tres modos** y los separa con un puerto (`VerificadorBiometricoPort`)
para poder cambiar uno por otro sin tocar el dominio:

| Modo | Qué hace | Estado |
|---|---|---|
| **A — Identidad por PIN/QR + foto** | El PIN o el QR identifican; la foto queda como evidencia revisable. Funciona en cualquier Android con cámara frontal. | **v1 — implementar** |
| **C — Multi-huella del SO (presencia)** | Se registran las huellas de varios empleados en los ajustes del propio celular. En la checada, después de identificarse con PIN/QR, el empleado toca el sensor: el SO confirma que **alguien con una huella enrolada en este equipo** está presente. **Se documenta en pantalla y en el comprobante que esto NO es identidad.** Nunca se guarda ni se sube dato de huella. Ver sección 2.1 (límites y procedimiento). | **v1 — implementar** |
| **B — Lector USB de huellas (OTG) con matching real** | Identificación por huella de verdad, con plantillas por empleado. Requiere hardware externo, SDK nativo del fabricante y *development build* (no funciona en Expo Go). | **Fase 2 — solo dejar el puerto listo** |

Regla de producto: el comprobante y el panel del admin deben decir qué métodos se usaron en cada
checada (`metodoIdentificacion: "pin" | "qr"`, `huellaOsConfirmada: boolean`, `foto: true/false`)
para que nadie lea "huella" y asuma identidad biométrica cuando no la hay.

### 2.1 Multi-huella en el mismo celular (Modo C): qué da y qué no

**Decisión de producto:** el kiosko usa el sensor del propio celular con varias huellas
enroladas (las de los empleados que el admin decida), sin comprar lector externo.

**Qué sí aporta:**
- Un tercer factor de **presencia física**: no basta teclear un PIN, hace falta que alguien con
  una huella registrada en ese equipo toque el sensor en ese momento.
- Funciona con hardware que el negocio ya tiene y sin SDK adicional.

**Qué NO aporta (el agente debe respetarlo en UI, comprobante y textos):**
- **No liga huella con empleado.** `expo-local-authentication` usa el BiometricPrompt del SO y
  responde solo éxito/fallo. La app no recibe qué dedo ni de quién fue (el identificador de
  huella no está disponible para apps normales; verifícalo en la documentación de Android
  antes de construir). Por lo tanto, **si Ana teclea el PIN de Beto y pone su propio dedo, la
  huella pasa.** Lo que lo delata es la **foto**: sale Ana, no Beto, y va a revisión del coach.
  La huella del SO nunca reemplaza al PIN/QR ni a la foto.
- **No se puede contar ni listar las huellas enroladas.** La app solo puede saber si hay al
  menos una (`isEnrolledAsync`). Por eso el alta se hace con un **procedimiento declarativo**
  (abajo) y queda en bitácora quién la declaró.
- **Capacidad limitada:** la mayoría de los Android permite **alrededor de 5 huellas** por
  equipo (varía por fabricante). Un dedo ocupa una ranura. **Valida el máximo real en los 2
  equipos del parque objetivo antes de prometer esto a un negocio con más empleados.** Los
  empleados sin ranura disponible se marcan `requiereHuellaSO: false` y checan con PIN/QR +
  foto; eso **no** es una anomalía para ellos.
- **No hay baja individual.** Si un empleado se va, el admin no puede saber cuál de las
  huellas era la suya. Procedimiento de baja: **borrar todas las huellas del equipo y
  re-enrolar solo a los empleados vigentes.** Debe quedar en el instructivo y en la bitácora.
- **Riesgo de seguridad del equipo:** esas huellas también **desbloquean el celular**, incluido
  salir de "Fijar pantalla" si está configurado para pedir credencial. Consecuencia de
  diseño: **con multi-huella activo, el modo admin NO se protege con huella** (cualquier
  empleado enrolado pasaría). Solo con PIN de admin.

**Configuración por tenant:** `huellaSO: "off" | "presencia"` (antes existía "solo_admin";
queda **descartado** por el riesgo anterior).

**Procedimiento de alta de huella (declarativo, auditable):**
1. En modo admin, "Alta de huella" → elegir empleado → el empleado teclea su PIN.
2. La app abre los ajustes de seguridad de Android (intent de ajustes; confirma en la doc de
   Expo/React Native la forma de lanzarlo) y el empleado registra **su** dedo.
3. De vuelta en la app, el empleado toca el sensor como prueba; si el SO confirma, se guarda
   `huellaDeclaradaFecha` y `huellaDeclaradaPor` (admin) en el catálogo/bitácora.
4. Esto **no prueba** que la huella enrolada sea de ese empleado; solo deja constancia de que el
   procedimiento se siguió. Dilo así en el README.

**Qué guarda cada checada:** `huellaOsConfirmada: true|false` y, si es `false`,
`huellaOsMotivo: "no_aplica" | "cancelada" | "fallo" | "sin_sensor" | "sin_huella_enrolada"`.
Un fallo repetido (3 intentos) no bloquea: la checada continúa con `huellaOsConfirmada: false`
y entra a validación del coach si el empleado tenía `requiereHuellaSO: true`.

**Si algún día se necesita identidad real por huella** (ligar huella con empleado), la vía es el
**Modo B** (lector USB con plantillas por empleado) o que cada empleado use la huella de **su
propio celular** para firmar un reto del kiosko. Ambos son fase 2; el puerto
`VerificadorBiometricoPort` ya los admite.

## 3. Principios para equipos viejos

- Meta de parque: **Android 7+ (API 24)** con **2 GB de RAM**. Antes de elegir versión de Expo
  SDK, **verifica en la documentación oficial de Expo el `minSdkVersion` de esa versión** y elige
  una que cubra el Android más viejo del parque objetivo. No asumas el dato de memoria: si un
  equipo del parque tiene Android menor al mínimo, se documenta como no soportado.
- **Offline-first absoluto:** ninguna checada depende de red para completarse.
- **Cero ML en el dispositivo.** Nada de reconocimiento facial local: la foto es evidencia y la
  comparación (si algún día se hace) ocurre en el servidor.
- Dependencias mínimas (sección 5). Cada paquete nuevo debe justificarse.
- Fotos chicas: ancho 480 px, JPEG calidad ~0.6, objetivo **50–80 KB**, sin EXIF.
- La cámara solo está activa durante el paso de foto; se libera entre checadas (calor, memoria).
- Animaciones solo con `useNativeDriver`/opacidad/transform; nada pesado en el hilo JS.
- Distribución por **APK** (sideload) vía EAS Build, sin depender de Play Store.

## 4. Arquitectura del cliente (hexagonal, igual que el backend)

```
/src
  /domain
    Checada.ts                 # entidad: id, empleadoId, tipo, timestamps, hashPrev, hashActual, seq
    CadenaDeHash.ts            # value object: encadena checadas (tamper-evidence)
    ReglasAntirebote.ts        # misma persona < 60 s => duplicada, se ignora
    InferirTipoDeChecada.ts    # entrada / inicio comida / fin comida / salida según la última checada
    ports/
      CamaraPort.ts
      VerificadorBiometricoPort.ts   # modo C hoy, modo B (USB) mañana
      ColaOfflinePort.ts
      ApiPort.ts
      RelojPort.ts                   # hora del dispositivo + offset del servidor
      UbicacionPort.ts
      AlmacenSeguroPort.ts           # deviceToken
  /application
    EmparejarDispositivo.usecase.ts
    RegistrarChecada.usecase.ts
    SincronizarCola.usecase.ts
    SincronizarCatalogo.usecase.ts   # empleados + config (pull)
    EnviarLatido.usecase.ts          # heartbeat de salud
    DesbloquearAdmin.usecase.ts
  /infrastructure
    camera/CamaraExpo.ts             # expo-camera + expo-image-manipulator
    biometrics/VerificadorHuellaSO.ts # expo-local-authentication
    storage/ColaSQLite.ts            # expo-sqlite
    storage/AlmacenSeguroExpo.ts     # expo-secure-store
    http/ApiHttp.ts                  # fetch + zod
    clock/RelojConOffset.ts
    location/UbicacionExpo.ts
    background/TareaSync.ts          # expo-background-task + expo-task-manager
  /ui
    /screens (Emparejar, Kiosko, Identificar, Foto, Comprobante, Admin)
    /components
    /theme (tokens)
app/                                 # rutas de expo-router
```

Regla: `/domain` y `/application` **no importan nada de `expo-*` ni de `react-native`**. Todo lo
que toca hardware o red entra por un puerto. Con esto, los casos de uso se prueban con Jest sin
emulador, y el modo B (lector USB) será solo un adaptador nuevo.

## 5. Dependencias

```bash
npx create-expo-app@latest bizneai-kiosko --template blank-typescript
cd bizneai-kiosko
npx expo install expo-router expo-camera expo-image-manipulator expo-file-system \
  expo-local-authentication expo-sqlite expo-secure-store expo-network \
  expo-background-task expo-task-manager expo-keep-awake expo-location expo-crypto \
  expo-application expo-device expo-battery expo-navigation-bar expo-status-bar \
  expo-screen-orientation expo-build-properties expo-audio
npm install zod zustand
npm install -D jest jest-expo @testing-library/react-native @types/jest
```

Notas:
- `expo-background-task` es el reemplazo vigente de `expo-background-fetch`; **confirma el
  nombre y la API en la documentación de la versión de SDK que elijas** antes de usarlo.
- `expo-audio` es solo para el "beep" de confirmación; si en pruebas pesa en el equipo viejo,
  se elimina y se usa solo feedback visual.
- No agregar `react-query`: el motor de sincronización es propio y simple (sección 8).
- Fuentes: usa **fuente del sistema** por rendimiento; conserva los tokens de color del resto
  del producto (`--bg-void #0A0A12`, `--surface #1B1A2C`, `--indigo #6C63FF`, `--mint #34D399`,
  `--amber #F5A623`, `--red #F4685C`, texto `#EDEDF5` / `#8E8CA6`). Fondo oscuro: ahorra batería
  en pantallas OLED viejas y se ve bien a distancia.

### `app.json` (puntos clave)
```json
{
  "expo": {
    "name": "BizneAI Kiosko",
    "slug": "bizneai-kiosko",
    "orientation": "portrait",
    "android": {
      "package": "com.bizneai.kiosko",
      "permissions": ["CAMERA", "ACCESS_FINE_LOCATION", "USE_BIOMETRIC"]
    },
    "plugins": [
      "expo-router",
      ["expo-camera", { "cameraPermission": "BizneAI Kiosko usa la cámara para tomar tu foto al registrar asistencia." }],
      ["expo-location", { "locationWhenInUsePermission": "Se usa para confirmar que el kiosko está en la sucursal." }],
      ["expo-build-properties", { "android": { "usesCleartextTraffic": false } }]
    ]
  }
}
```
No bajes `minSdkVersion` por debajo del que trae el SDK por defecto.

### `eas.json` (APK instalable por sideload)
```json
{
  "build": {
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": { "android": { "buildType": "apk" } }
  }
}
```
Comando: `eas build -p android --profile preview`.

## 6. Identidad del dispositivo (modelo multi-tenant)

El kiosko **no es un usuario ni una membresía**: es un tercer tipo de principal en el backend.

- **Emparejamiento:** el admin genera en la app/panel un **código de 8 caracteres de un solo
  uso (caduca en 15 min)** para una sucursal. En el kiosko lo captura y la API devuelve un
  `deviceToken` (JWT con claims `rol: "dispositivo"`, `tenantId`, `sucursalId`, `deviceId`).
- El token se guarda en `expo-secure-store`. **Solo puede llamar los endpoints de la sección 9**;
  cualquier otra ruta responde 403.
- **Geocerca del dispositivo** (reemplaza el GPS por empleado): al emparejar, el kiosko toma una
  ubicación y el backend **rechaza el emparejamiento si no está dentro de la geocerca de la
  sucursal**. Después, cada latido incluye una ubicación de baja precisión; si el kiosko "se
  movió" fuera de la geocerca, el admin recibe alerta. Esto conserva la garantía "la checada
  ocurrió en la sucursal" sin pedir GPS a cada empleado.
- Un dispositivo se puede **revocar** desde el panel; el siguiente latido/sync recibe 401 y la
  app muestra "Dispositivo desvinculado" y borra token y datos locales no sincronizados solo
  después de confirmar que la cola está vacía (si no, entra en modo "bloqueado, requiere admin").

## 7. Pantallas y UX

1. **Emparejar (primera vez):** campo de código, botón "Vincular a sucursal". Errores claros:
   código vencido, fuera de geocerca, sin red.
2. **Kiosko (pantalla de reposo):** reloj grande y fecha, nombre de sucursal, botón enorme
   "Checar". Arriba, tres indicadores discretos: **sync** (verde = al corriente, ámbar =
   pendientes N, rojo = sin sync > 1 h), **batería**, **red**.
3. **Identificar:** teclado numérico grande (PIN de 4–6 dígitos) o botón "Escanear mi QR".
   Bloqueo tras 5 intentos fallidos: 60 s (el backoff crece). Sin pistas de si el empleado existe.
4. **Foto:** vista de cámara frontal con marco guía, cuenta regresiva 3-2-1 y disparo
   automático. Si falla (sin permiso, cámara ocupada, timeout 8 s) se permite continuar con
   marca `sin_foto` → cae a la **cola de validación del coach** (mismo patrón de "pendiente de
   pase" del sistema principal; no se bloquea al colaborador).
5. **Multi-huella del SO (si el tenant tiene `huellaSO: "presencia"` y el empleado tiene
   `requiereHuellaSO: true`):** texto fijo en pantalla: *"Confirma tu presencia con tu huella.
   Esto no identifica quién eres; tu identidad ya quedó con tu PIN y tu foto."* Máximo 3
   intentos; después continúa sin huella (ver 2.1). Si el equipo no tiene sensor, este paso se
   omite y se guarda `huellaOsMotivo: "sin_sensor"`.
6. **Comprobante (3 s):** nombre, tipo de checada (Entrada/Salida/Comida), hora, folio corto,
   sonido/color de confirmación. Si fue offline: "Guardado — se sincronizará".
7. **Modo admin** (se entra **solo con PIN de admin**; la huella del SO no se acepta porque, con
   multi-huella, cualquier empleado enrolado podría entrar): "Alta de huella" y "Borrar huellas
   y re-enrolar" (guías paso a paso, ver 2.1), cola pendiente, "Sincronizar ahora",
   diagnóstico (versión, espacio libre, última sync, desfase de reloj), desvincular, cambiar
   volumen/brillo. Nunca muestra datos de otros tenants.
8. **Aviso de privacidad:** en la pantalla de reposo, enlace discreto "Aviso de privacidad"
   (versión simplificada y QR al aviso integral). El acuerdo de uso del registro y el
   consentimiento de foto se firman en el alta, no en el kiosko (ver sección 11).
9. **Mis checadas** (con PIN): las registradas en este kiosko en los últimos 14 días, con folio,
   hora y tipo; botón "Reportar un error" que crea un caso para el coach (nunca edita la
   checada).
10. **Ley Silla** (ver 11 bis): tarjeta de aviso rotativa en reposo; si el tenant lo activa,
    botones "Pausa" (inicio y fin) y "Reportar problema con asiento".

Estados de error que **deben** tener pantalla: sin permiso de cámara, almacenamiento < 200 MB,
batería < 15 % sin cargador, reloj desfasado, token revocado, sin sensor de huella.

## 8. Datos locales, integridad y sincronización

### SQLite (`expo-sqlite`)
- `config` — deviceId, tenantId, sucursalId, geocerca, opciones del tenant (huella sí/no, método
  de identificación), `offsetServidorMs`, `ultimaSyncOk`.
- `empleados` — id, nombre, `pinHash` + `salt` (hash **SHA-256 con salt por empleado entregado
  por el servidor**), `qrId`, `activo`, `requiereHuellaSO`, `huellaDeclaradaFecha`,
  `huellaDeclaradaPor`, `acuerdoVigente`, `acuerdoVersion`, `consentimientoFotoVigente`. El PIN
  nunca se guarda en claro. Un empleado solo llega como `activo` si tiene `acuerdoVigente` y
  `consentimientoFotoVigente`.
- `checadas` — `id` (uuid), `seq` (consecutivo **por dispositivo**, sin huecos), `empleadoId`,
  `tipo`, `tsDispositivo`, `offsetAplicado`, `fotoPath`, `fotoSha256`, `metodoIdentificacion`,
  `huellaOsConfirmada`, `lat`, `lng`, `accuracy`, `hashPrev`, `hashActual`, `estadoSync`
  (`pendiente` | `meta_ok` | `foto_ok` | `error`), `intentos`.
- Valores de `tipo`: `entrada`, `salida`, `comida_inicio`, `comida_fin`, `pausa_inicio`,
  `pausa_fin` y `correccion` (esta referencia a `eventoOriginalId`, `motivo`, `solicitadaPor`,
  `aprobadaPor`). Los eventos **nunca se editan ni se borran**.
- `reportes_ley_silla` — id, empleadoId, motivo, texto, `ts`, `estadoSync`. Idempotente por id.

### Integridad (que se note si alguien manipula)
- Cada checada lleva `hashActual = SHA256(hashPrev + JSON canónico de la checada)` con
  `expo-crypto`. El servidor **verifica la cadena y que `seq` no tenga huecos**; una ruptura o
  un hueco genera un caso para el admin.
- Es *evidencia de manipulación*, no inviolabilidad: un dueño que borre la base local deja un
  hueco de `seq` que el servidor detecta. Documéntalo así; no lo vendas como "a prueba de todo".
- **Reloj:** el dispositivo guarda el `offsetServidorMs` de la última respuesta del servidor y
  lo aplica a las checadas offline. Si `Date.now()` retrocede respecto al último registro, se
  marca `reloj_retrocedio`; si el desfase con el servidor supera 5 min, se marca `reloj_desfasado`
  (ambas van a validación del coach, no bloquean).

### Motor de sync
- **Push:** lotes de hasta 20 checadas, **idempotente por `id`** (reenviar nunca duplica). Primero
  metadatos (ligeros), luego la foto de cada checada por separado, con reintentos de backoff
  exponencial + jitter y tope de 1 h entre intentos.
- Se borra la foto local **solo después** de que el servidor confirme recibo y `sha256`
  coincidente. Jamás se borra nada con `estadoSync` distinto de `foto_ok`.
- **Pull:** `GET sincronizacion?since=` trae empleados y config (con `ETag`/`updatedSince`).
  El servidor manda en catálogos; el dispositivo manda en eventos (append-only).
- **Disparadores:** al recuperar red, al volver a primer plano, cada 5 min en primer plano y
  tarea en segundo plano cada ~15 min (best-effort: Android en equipos viejos mata procesos;
  en el instructivo se pide quitar la app de la optimización de batería).
- **Latido** cada 5 min en primer plano: batería, espacio libre, tamaño de cola, versión de app,
  desfase de reloj, ubicación de baja precisión. Si el servidor no recibe latido en 15 min, el
  admin ve el kiosko como "sin conexión".

## 9. Contrato de API (módulo nuevo `dispositivos` en el backend hexagonal)

```
POST /api/v1/dispositivos/emparejar
     body: { codigo, androidIdHash, modelo, osVersion, appVersion, lat, lng }
     → { deviceId, deviceToken, tenantId, sucursalId, geocerca, config, serverTime }

GET  /api/v1/dispositivos/sincronizacion?since=ISO
     → { empleados:[{id,nombre,pinHash,salt,qrId,activo}], config, serverTime }

POST /api/v1/dispositivos/checadas/lote
     body: { checadas:[...] }  → [{ id, estado:"ok"|"duplicada"|"rechazada", motivo? }]

PUT  /api/v1/dispositivos/checadas/:id/foto      (multipart, JPEG, valida sha256)

POST /api/v1/dispositivos/latido
     body: { bateria, espacioLibreMB, colaPendiente, appVersion, desfaseRelojMs, lat, lng }

POST /api/v1/dispositivos/desemparejar

GET  /api/v1/dispositivos/ley-silla/config
     → { aviso, ubicacionesAsientos, registrarPausas, fotoEnPausas }

POST /api/v1/dispositivos/ley-silla/reportes        (idempotente por id)

POST /api/v1/dispositivos/correcciones/solicitud    (el empleado reporta un error en una checada)
```

`checadas/lote` también acepta los tipos `pausa_inicio` y `pausa_fin`. Las rutas de
administración de Ley Silla están en la sección 11 bis.

Todas las respuestas incluyen `serverTime`. Errores con formato `{ error, code }`. El
`deviceToken` solo autoriza estas rutas; el `tenantId` sale del token (nunca del body), igual que
en el resto del backend multi-tenant. Cada checada rechazada o con anomalía (`sin_foto`,
`reloj_*`, ruptura de cadena) entra a la cola del coach con su motivo.

## 10. Endurecimiento "modo kiosko" en Android

- `expo-keep-awake` para que no se apague la pantalla; barra de navegación oculta/inmersiva con
  `expo-navigation-bar`; orientación bloqueada con `expo-screen-orientation`.
- **v1:** usar la función nativa de Android **"Fijar pantalla"** (screen pinning), configurada a
  mano por el admin; documentarlo en el instructivo con capturas.
- **Fase 2 (no implementar ahora):** bloqueo total con *device owner*/lock task, arranque
  automático tras reinicio (requiere plugin de configuración nativo) y actualizaciones OTA con
  `expo-updates`, que le servirían mucho a un parque de equipos sin Play Store.
- **Seguridad física:** estos equipos van **conectados a corriente de forma continua**; una
  batería vieja hinchada es un riesgo real. Incluir en el instructivo: revisar la batería
  periódicamente y retirarla/cambiarla si se nota abombada.

## 11. Marco legal verificado y privacidad (revisado el 31-oct-2026)

> Resumen de lo que se verificó con fuentes. **No es asesoría legal**: un abogado laboral debe
> revisar el texto del acuerdo, el aviso de privacidad y los plazos de conservación antes de
> producción. Etiquetas: **[LEY]** texto leído directamente; **[FUENTE]** reporte de despachos o
> medios, sin cotejar con el DOF; **[PENDIENTE]** aún no existe o no se pudo confirmar.

| Tema | Qué se encontró | Estado |
|---|---|---|
| Obligación de registro | LFT art. 132 fr. XXXIV (adicionada en el DOF del 1-may-2026): registrar electrónicamente la jornada de cada persona trabajadora, con hora de inicio y de término, y proporcionarlo a la autoridad cuando lo requiera. | [LEY] (texto en Justia; última reforma DOF 14-05-2026) |
| Valor probatorio | El registro hace **prueba plena si se acredita que fue acordado** entre trabajador y patrón. | [LEY] |
| Multa | 250 a 5,000 UMA por no llevar el registro (art. 994 fr. IV Bis). | [FUENTE]: cotejar en el DOF |
| Método | La ley no exige biometría, geolocalización, hardware específico ni nube; un kiosko o app es válido. **No afirmes en la app ni en la documentación que la ley exige o avala la biometría o el reconocimiento facial: no lo dice.** | [LEY] + [FUENTE] |
| Reglas técnicas de la STPS | La STPS emitirá disposiciones generales (ámbito, excepciones, cómo registrar) con vigencia al 1-ene-2027. Al 29-oct-2026 **no estaban publicadas**; se espera la primera quincena de dic-2026 (fecha no confirmada por la STPS federal). Se ha mencionado un posible periodo de gracia de 30 a 60 días (especulación). | [PENDIENTE] |
| Criterios judiciales | Los registros de un reloj electrónico han servido como prueba cuando el trabajador aceptó el mecanismo, quien lo opera lo reconoce y hay otros elementos (tesis 181716); los documentos digitales se perfeccionan según su naturaleza (tesis 2021279). En juicio hay que poder explicar cómo se generó el registro, quién puede modificarlo y qué controles lo protegen. | [FUENTE] |
| Datos personales | Nueva LFPDPPP (DOF 20-mar-2025; última reforma 14-nov-2025 según el texto de Diputados). Son sensibles los datos que afectan "la esfera más íntima"; en el texto leído **no aparece la palabra "biométricos"**. Los sensibles requieren **consentimiento expreso y por escrito** (la firma puede ser electrónica). La autoridad es la Secretaría Anticorrupción y Buen Gobierno, que sustituye al INAI. | [LEY] (lectura automatizada: confirmar artículos con el abogado) |

**Decisión de diseño por precaución:** como la definición de dato sensible es abierta, trata la
**foto del rostro** como dato potencialmente sensible: consentimiento expreso y por escrito,
finalidad única (verificar asistencia) y nuevo consentimiento si algún día se usa para otra cosa
(por ejemplo, comparación facial en servidor).

### Cambios que esto exige al diseño

1. **Acuerdo de uso del registro electrónico, firmado por cada colaborador.** Es lo que vuelve
   el registro "acordado" (prueba plena). Campos: `acuerdoVersion`, `acuerdoTextoHash`,
   `acuerdoFirmadoEn`, `acuerdoFirmaMetodo`, `acuerdoCapturadoPor`. Un checkbox no basta: se
   guarda la versión exacta del texto firmado. Sin acuerdo vigente, el empleado llega al kiosko
   con `activo: false`. Contenido sugerido (recomendación de despachos, no texto legal): medio
   electrónico usado, datos que se registran, cómo se marca entrada y salida, cómo reportar
   errores, cómo se validan las correcciones, plazo de conservación, acceso del trabajador y
   efectos probatorios.
2. **Consentimiento expreso y por escrito aparte para la foto**, separado del acuerdo de
   jornada. Debe mencionar también la confirmación con la huella del SO, aunque la app nunca
   recibe ni guarda datos de huella.
3. **Aviso de privacidad accesible desde el kiosko** (versión simplificada con QR al aviso
   integral) y entregado en el alta.
4. **El trabajador puede consultar sus propias checadas** (con su PIN: últimos 14 días, folio,
   hora, si hubo foto). La ley no lo exige; se recomienda porque reduce controversias y refuerza
   que el registro es "acordado".
5. **Correcciones solo por adición.** Nunca se edita ni se borra una checada: una corrección es
   un evento nuevo `correccion` (referencia al original, motivo, quién la pidió, quién la
   aprobó) dentro de la misma cadena de hash. Así se puede explicar en juicio quién modifica y
   con qué controles.
6. **Conservación configurable.** Las fuentes leídas no fijan un plazo para el registro (solo
   mencionan el art. 804 LFT sobre conservación y exhibición, sin duración). Implementa
   `retencionRegistroMeses` y `retencionFotosDias` por tenant, **sin valor por defecto hasta que
   legal lo defina**; al vencer, bloqueo y supresión.
7. **Exportación para la autoridad:** reporte por periodo con verificación de la cadena de hash
   (en backend).
8. **Reglas versionadas (`politicaRegistro`).** Como las disposiciones de la STPS pueden cambiar
   requisitos (identificación, conservación, métodos, acceso del trabajador), nada de esto va
   fijo en el código. Ver hito M8.

### Seguridad y datos (se mantiene)

- **Retención de fotos configurable por tenant** en el servidor (valor por defecto a definir con
  legal). En el dispositivo, las fotos se borran al confirmarse la sync.
- TLS siempre (`usesCleartextTraffic: false`). Archivos en el almacenamiento privado de la app.
  Nota honesta: en Android viejo el cifrado en reposo del dispositivo puede no estar activo; por
  eso la foto no se queda local más de lo necesario.
- **Nunca** se guarda, transmite ni registra ningún dato de huella (el SO no lo expone y la app
  no debe intentar obtenerlo).

## 11 bis. Módulo Ley Silla

### Qué dice la norma (según lo verificado)
- Reforma a la LFT publicada el 19-dic-2024: modifica los arts. 132, 133, 422 y 423. [FUENTE]
- Art. 133 fr. XVII Bis: se prohíbe obligar a las personas trabajadoras a permanecer de pie
  durante toda la jornada. [LEY, leído en Justia] El patrón debe proveer un **número suficiente
  de asientos con respaldo**, en el puesto o en un área cercana, para trabajar sentado o
  descansar. [FUENTE]
- La STPS emitió disposiciones sobre factores de riesgo por bipedestación el 17-jul-2025.
  [FUENTE: EY, Basham] Las fuentes difieren en la fecha de exigibilidad (17-jun-2025, con 180
  días para adecuar políticas y Reglamento Interior de Trabajo; otras indican dic-2025); en
  cualquier caso **ya es exigible hoy**.
- Según EY, las disposiciones piden: diagnóstico con la **Comisión de Seguridad e Higiene**,
  registro de recorridos y diagnósticos, información de cada trabajador evaluado y un diagrama
  de cumplimiento. Clasifican la bipedestación en estática, dinámica y prolongada (más de 3
  horas continuas de pie).
- **Lo que la norma NO fija** (según EY): número de asientos por trabajador, características de
  las sillas ni tiempos de descanso. Cualquier cifra en la app es un **default de producto
  configurable**, no un requisito legal.
- **Fuentes en conflicto:** Basham describe un puntaje de siete factores con riesgo
  bajo/medio/alto y tipo de asiento según el nivel; EY indica que las disposiciones no incluyen
  puntajes ni niveles. **No implementes puntajes ni niveles como si fueran oficiales.** Guarda la
  evaluación con un campo `metodologia` (versionado) y campos descriptivos, y coteja el texto
  oficial del DOF (17-jul-2025) antes de automatizar cualquier cálculo.
- Sanciones: el decreto no fija una multa específica; aplican las multas generales de
  inspección (hasta 5,000 UMA). [FUENTE]

### Qué hace el kiosko (y qué no)
El kiosko es un equipo fijo en la entrada: **no vigila posturas ni tiempos de pie**. Aporta tres
cosas:

1. **Aviso.** Tarjeta rotativa en la pantalla de reposo, con texto configurable por sucursal:
   derecho a sentarse y dónde están los asientos.
2. **Pausas (opcional por tenant: `leySilla.registrarPausas`).** Botones "Inicio de pausa" y
   "Fin de pausa" con PIN (sin foto por defecto: `fotoEnPausas: false`). Son eventos
   `pausa_inicio` y `pausa_fin` en la misma cadena de hash. Sirven como evidencia de que los
   descansos se usan. **Contrapartida:** el mismo registro también puede mostrar que no hay
   pausas; ver decisión abierta 8.
3. **Reporte de problema con asiento** (con PIN). Motivos: `sin_asiento`, `asiento_danado`,
   `no_me_dejan_sentarme`, `otro`, más un texto de hasta 200 caracteres. Va a la cola del
   **administrador**, no a la del coach de turno, para no exponer al trabajador ante su
   supervisor directo. Idempotente por `id`; el empleado ve un folio de confirmación.

Los recordatorios de postura por horas, si se quieren, pertenecen a la app del colaborador y su
umbral es configurable (default de producto, no cifra legal).

### Qué hace el backend (módulo `ley-silla`, bounded context nuevo)
Entidades: `PuestoDeTrabajo` (sucursal, nombre, tipo de bipedestación, horas de pie continuas
estimadas), `EvaluacionDePuesto` (fecha, evaluador, `metodologia`, respuestas, conclusión,
asiento recomendado, vigencia), `InventarioAsientos` (sucursal, puesto o área, tipo, cantidad,
ubicación, fotos, estado, fecha), `RecorridoComision` (fecha, participantes, hallazgos, acta
adjunta), `ReporteLeySilla` y `ConfigLeySilla` (aviso, ubicaciones, pausas).

**Semáforo por sucursal con criterios documentales**, no numéricos:
- ¿Todo puesto en bipedestación tiene una evaluación vigente?
- ¿Hay inventario de asientos con foto y fecha?
- ¿Hay acta de recorrido reciente? (frecuencia configurable; default de producto, no legal)
- ¿El Reglamento Interior de Trabajo está actualizado? (casilla declarativa y archivo adjunto)
- ¿Hay reportes abiertos?

La comparación "asientos ≥ puestos de pie" queda como **alerta heurística configurable**, no
como criterio de cumplimiento legal.

**Expediente de inspección:** exportación por sucursal con puestos, evaluaciones, inventario con
fotos, actas, reportes y su resolución.

Rutas del administrador (JWT de membresía, no de dispositivo):

```
GET/POST /api/v1/ley-silla/puestos
GET/POST /api/v1/ley-silla/puestos/:id/evaluaciones
GET/POST /api/v1/ley-silla/sucursales/:id/inventario-asientos
GET/POST /api/v1/ley-silla/sucursales/:id/recorridos
GET      /api/v1/ley-silla/reportes
POST     /api/v1/ley-silla/reportes/:id/resolver
GET      /api/v1/ley-silla/sucursales/:id/semaforo
GET      /api/v1/ley-silla/sucursales/:id/expediente
```

La interfaz de administración de Ley Silla vive en la app de admin ya prototipada; este prompt
solo fija los contratos de API y el comportamiento del kiosko.

## 12. Estructura de pruebas

- **Jest (sin emulador):** `CadenaDeHash`, `ReglasAntirebote`, `InferirTipoDeChecada`, casos de
  uso con puertos falsos (cola en memoria, API simulada, reloj controlable).
- **Escenarios clave (Gherkin, contrato del comportamiento):**

```gherkin
# language: es
Característica: Kiosko de asistencia en Android

  Escenario: Checada sin red se guarda y se sincroniza después
    Dado que el kiosko no tiene conexión
    Cuando "Renata Solís" se identifica con su PIN y se toma la foto
    Entonces la checada se guarda localmente con estado "pendiente"
    Y al recuperar la red se envía con su foto y queda "foto_ok"
    Y la foto local se elimina solo después de la confirmación del servidor

  Escenario: Reenviar un lote no duplica checadas
    Dado que una checada ya fue aceptada por el servidor
    Cuando el kiosko la reenvía por reintento
    Entonces el servidor responde "duplicada" y no crea un segundo registro

  Escenario: Cámara no disponible no bloquea al colaborador
    Dado que la cámara falla durante el paso de foto
    Cuando el colaborador continúa
    Entonces la checada se guarda con marca "sin_foto"
    Y aparece en la cola de validación del coach

  Escenario: La huella del sistema no se presenta como identidad
    Dado que el tenant tiene "huellaSO: presencia"
    Cuando el colaborador confirma su presencia con la huella
    Entonces el comprobante registra "huellaOsConfirmada: true"
    Y la identidad se atribuye únicamente al PIN o QR y a la foto

  Escenario: Un empleado sin huella enrolada no genera anomalía
    Dado que "Beto" tiene "requiereHuellaSO: false" por falta de ranuras en el equipo
    Cuando checa con su PIN y su foto
    Entonces la checada se guarda con "huellaOsMotivo: no_aplica"
    Y no se agrega a la cola de validación por ese motivo

  Escenario: Falla repetida de la huella no bloquea al empleado
    Dado que "Ana" tiene "requiereHuellaSO: true"
    Cuando falla 3 veces la lectura de huella
    Entonces la checada continúa con "huellaOsConfirmada: false" y "huellaOsMotivo: fallo"
    Y aparece en la cola de validación del coach

  Escenario: El modo admin no acepta la huella del sistema
    Dado que el tenant tiene "huellaSO: presencia"
    Cuando un empleado con huella enrolada intenta entrar al modo admin con su dedo
    Entonces el acceso no se concede
    Y solo se permite con el PIN de admin

  Escenario: Baja de un empleado con huella enrolada
    Dado que "Carlos" fue dado de baja y tenía una huella en el equipo
    Cuando el admin ejecuta "Borrar huellas y re-enrolar"
    Entonces queda registrado quién y cuándo lo hizo
    Y solo se re-enrolan los empleados vigentes

  Escenario: Kiosko emparejado fuera de la sucursal
    Dado que el kiosko está a más de 300 metros de la geocerca de la sucursal
    Cuando el admin intenta emparejarlo
    Entonces el emparejamiento es rechazado

  Escenario: Hueco en la secuencia de checadas
    Dado que el servidor recibió las checadas con seq 41 y 43
    Cuando verifica la cadena del dispositivo
    Entonces genera una alerta para el admin por "hueco de secuencia"

  Escenario: Reloj del dispositivo desfasado
    Dado que el reloj del kiosko difiere más de 5 minutos del servidor
    Cuando se registra una checada
    Entonces se marca "reloj_desfasado" y pasa a validación del coach

  # --- Marco legal ---

  Escenario: Un empleado sin acuerdo firmado no puede checar
    Dado que "Mario" no tiene un acuerdo de uso del registro vigente
    Cuando el kiosko sincroniza el catálogo
    Entonces "Mario" llega con "activo: false"
    Y su PIN no permite checar

  Escenario: Un empleado sin consentimiento de foto no puede checar
    Dado que "Mario" firmó el acuerdo de jornada pero no el consentimiento de foto
    Cuando el kiosko sincroniza el catálogo
    Entonces "Mario" llega con "activo: false"

  Escenario: Una corrección no modifica la checada original
    Dado que existe una checada con un error de hora
    Cuando el coach aprueba la corrección solicitada
    Entonces se agrega un evento "correccion" que referencia el original
    Y la checada original permanece sin cambios dentro de la cadena de hash

  Escenario: El empleado consulta sus checadas
    Dado que "Renata" checó 3 veces esta semana en este kiosko
    Cuando entra a "Mis checadas" con su PIN
    Entonces ve las 3 checadas con folio, hora y tipo
    Y no ve las de otros empleados

  Escenario: El aviso de privacidad es accesible desde el kiosko
    Dado que el kiosko está en la pantalla de reposo
    Cuando alguien toca "Aviso de privacidad"
    Entonces se muestra la versión simplificada y el QR al aviso integral

  # --- Ley Silla ---

  Escenario: El aviso de Ley Silla se muestra en reposo
    Dado que la sucursal tiene un aviso de Ley Silla configurado
    Cuando el kiosko está en la pantalla de reposo
    Entonces se muestra la tarjeta con el derecho a sentarse y la ubicación de los asientos

  Escenario: Registrar una pausa con PIN y sin foto
    Dado que el tenant tiene "registrarPausas" activo y "fotoEnPausas: false"
    Cuando "Ana" teclea su PIN y toca "Inicio de pausa"
    Entonces se guarda un evento "pausa_inicio" sin foto en la cadena de hash

  Escenario: Los botones de pausa no aparecen si el tenant no los activa
    Dado que el tenant tiene "registrarPausas" desactivado
    Cuando el kiosko está en la pantalla de reposo
    Entonces no se muestran los botones de pausa

  Escenario: Un reporte de asiento va al administrador y no al coach
    Dado que "Ana" reporta "no_me_dejan_sentarme" con su PIN
    Cuando el reporte se sincroniza
    Entonces aparece en la cola del administrador
    Y no aparece en la cola del coach de turno
    Y "Ana" recibe un folio de confirmación

  Escenario: Reenviar un reporte de asiento no lo duplica
    Dado que un reporte ya fue aceptado por el servidor
    Cuando el kiosko lo reenvía por reintento
    Entonces el servidor responde "duplicada" y no crea un segundo reporte

  Escenario: El semáforo de Ley Silla es documental
    Dado que una sucursal tiene un puesto en bipedestación sin evaluación vigente
    Cuando el administrador abre el semáforo de la sucursal
    Entonces el criterio "evaluación vigente" aparece pendiente
    Y la comparación entre asientos y puestos se muestra solo como alerta
```

- **Pruebas en equipo real viejo (obligatorias antes de dar por terminado):** define 2 equipos
  del parque objetivo (uno con 2 GB de RAM y Android 7/8). Métricas de aceptación: arranque en
  frío < 6 s; checada completa (identificar → foto → comprobante) < 8 s; APK < 40 MB;
  24 h continuas sin cierres ni fugas visibles de memoria; 100 checadas offline sincronizadas
  sin pérdida ni duplicados.

## 13. Plan de construcción por hitos

| Hito | Entregable | Criterio de aceptación |
|---|---|---|
| M0 | Scaffold, TypeScript estricto, estructura hexagonal, Jest corriendo | `npm test` verde con una prueba de dominio |
| M1 | Dominio + casos de uso con puertos falsos | Cobertura de cadena de hash, antirebote, inferencia de tipo |
| M2 | Emparejamiento + pull de catálogo + SQLite | Kiosko vinculado con un backend de pruebas y empleados cacheados |
| M3 | Flujo de checada: PIN/QR → foto → comprobante, todo offline | 20 checadas offline guardadas con foto de 50–80 KB |
| M4 | Sync push idempotente, reintentos, latido, tarea de fondo | 100 checadas sin pérdida ni duplicados con red intermitente |
| M5 | Modo admin, huella del SO, modo kiosko, estados de error | Todos los estados de la sección 7 tienen pantalla |
| M6 | Acuerdo y consentimientos en el catálogo, correcciones por adición, "Mis checadas", aviso de privacidad, módulo Ley Silla (kiosko y backend) | Escenarios legales y de Ley Silla de la sección 12 en verde |
| M7 | Pruebas en equipo viejo + APK por EAS | Métricas de la sección 12 cumplidas, instructivo de instalación |
| M8 | Revisión contra los lineamientos de la STPS (esperados en dic-2026) | Checklist de cumplimiento revisado por el abogado; ajustes vía `politicaRegistro` sin tocar el dominio |

## 14. Fuera de alcance de esta v1

- Lector USB de huellas con matching real (Modo B) — solo queda el puerto definido.
- Reconocimiento facial en el dispositivo o comparación de rostros (si se hace, es en servidor).
- Arranque automático tras reinicio, device owner/lock task, OTA con `expo-updates`.
- iOS e iPad.
- Cálculo de nómina, salario o turnos en el kiosko (todo eso vive en el backend y la app admin).
- Cálculo automático de puntajes o niveles de riesgo de Ley Silla, hasta cotejar el texto oficial
  del DOF.
- Detección de posturas o de tiempo de pie: el kiosko no vigila a nadie.

## 15. Decisiones abiertas — confirmar con el humano antes de construir

1. ¿El método de identificación por defecto es **PIN** o **QR de credencial**? (El PIN de 4–6
   dígitos es débil por sí solo; la foto y la bitácora lo compensan, pero el QR es más fuerte.)
2. **Decidido:** multi-huella del SO como paso de presencia en la checada (no para admin).
   Pendiente: ¿cuántas ranuras de huella tiene realmente el equipo del parque objetivo y
   cuántos empleados por sucursal necesitan huella? Si hay más empleados que ranuras, ¿quién
   tiene prioridad y el resto checa solo con PIN/QR + foto?
3. Política de **retención de fotos** en servidor (días) — requiere visto bueno de legal.
4. Si falla la foto: la propuesta es permitir con marca `sin_foto` + revisión del coach. ¿Hay
   sucursales (ej. vigilancia nocturna) donde deba **bloquear** en vez de permitir?
5. ¿Hay interés real en el **Modo B** (lector USB)? Si sí, conviene elegir el hardware antes de
   la fase 2, porque define el SDK nativo y el flujo de enrolamiento.
6. **Legal (bloqueante para producción):** revisión por abogado laboral del texto del acuerdo de
   uso del registro, del consentimiento de foto, del aviso de privacidad y del plazo de
   conservación (registro y fotos).
7. **Lineamientos de la STPS:** no están publicados (se esperan en la primera quincena de
   dic-2026, sin confirmar). ¿Se lanza antes con `politicaRegistro` configurable y se revisa en
   M8, o se espera a que salgan?
8. **Pausas de Ley Silla:** ¿se registran los inicios y fines de pausa? Ayuda a demostrar el uso
   de descansos, pero también deja evidencia si no se toman. Decisión del dueño con su abogado.
9. **Ley Silla, método de evaluación:** hay que cotejar el texto oficial de las disposiciones
   (DOF 17-jul-2025) para saber si existe un puntaje o un diagrama obligatorio antes de
   automatizar la evaluación de puestos.

## 16. Instrucciones de trabajo para el agente

- Trabaja por hitos (M0 → M8) y entrega al terminar cada uno; no avances si el criterio de
  aceptación del hito anterior no se cumple.
- **No inventes** versiones, nombres de API ni requisitos mínimos de Android: verifícalos en la
  documentación oficial de Expo para la versión de SDK que elijas y deja constancia en el README.
- Mantén `/domain` y `/application` libres de dependencias de `expo-*`/`react-native`.
- No agregues dependencias fuera de la sección 5 sin justificarlo en el README.
- Documenta en el README: instalación del APK por sideload, cómo fijar pantalla, cómo excluir la
  app de la optimización de batería y el aviso de seguridad de la batería.

---

# PARTE 4 — Dashboard web: tiempo extra, SAT, IMSS y STPS

<!-- origen: prompt-dashboard-nomina-legal-web.md -->

# Prompt de construcción — Dashboard web de tiempo extra y cumplimiento (SAT · IMSS · STPS)

> Para pegar en Claude Code. Complementa a `prompt-arquitectura-hexagonal-multitenant.md`,
> `prompt-salario-negociado-expo.md` y `prompt-kiosko-asistencia-expo.md`: este dashboard **consume**
> las checadas del kiosko y el salario pactado, y **produce** pre-nómina y semáforos de cumplimiento.
>
> **Fecha de revisión legal: 31-oct-2026.** Etiquetas: **[LEY]** texto leído; **[FUENTE]** despacho o
> medio, sin cotejar con el DOF; **[PENDIENTE]** no existe aún o no se pudo confirmar.
> Nada de aquí es asesoría legal ni fiscal. Todo cálculo es **estimación de pre-nómina**: el contador
> valida y timbra.

---

## 0. Lo que NO se pudo verificar (leer primero)

1. El video de YouTube compartido **no se pudo abrir** desde este entorno (error del sitio). No se usó su
   contenido. Sí se usó la **imagen** de la tabla (ver sección 4.4): es coherente con la regla de
   exención del ISR, y su caso se incluye como prueba de oro.
2. Los límites diarios/semanales del tiempo extra (¿3 h y 3 días, o 4 h y 4 días?) y si las horas triples
   caben en el tope de 16 h semanales **cambian según la fuente** (sección 4.2). Por eso son
   **parámetros versionados**, no constantes en el código. Cotejar con el DOF del 1-may-2026.
3. Las tablas de ISR, el subsidio y las cuotas IMSS **no están en este prompt a propósito**: cambian cada
   año. El sistema las carga de un catálogo versionado (sección 4.7) y el abogado/contador las valida.
4. El tope de exención de ISR se expresa en la ley como "5 veces el salario mínimo" y varios despachos lo
   aplican en UMA. **Es una pregunta abierta** (sección 11, decisión 1); el sistema soporta ambas.

---

## 1. Objetivo

Un **dashboard web** para dueños, contadores y RH de PyMEs mexicanas que, a partir de las checadas
(GPS/foto/kiosko) y el salario pactado:

1. Calcula **horas ordinarias, extra dobles, extra triples, descanso trabajado, festivos y prima
   dominical** por persona y por semana.
2. Estima **pago bruto**, **parte exenta y gravada de ISR**, **efecto en el SBC del IMSS** y **costo
   patronal**.
3. Muestra **semáforos de cumplimiento** SAT / IMSS / STPS con evidencia exportable.
4. Entrega una **pre-nómina** exportable (CSV/XLSX/JSON) lista para que el contador la timbre.

Postura del producto: **del lado del patrón**, con evidencia clara. Pero un cálculo que subpaga o evade
cuotas no ayuda al patrón: cuando la ley sea ambigua, el sistema muestra **ambos escenarios** y marca el
conservador como predeterminado.

---

## 2. Arquitectura (hexagonal, Node, Expo, MongoDB Atlas)

### 2.1 Monorepo

```
/
├─ apps/
│  ├─ api/                    # Node 22 + TypeScript (hexagonal)
│  └─ dashboard/              # Expo (Expo Router) con salida web; mismo código puede correr en móvil
├─ packages/
│  ├─ calculo/                # DOMINIO PURO: fórmulas de tiempo extra, ISR, IMSS, STPS. Sin I/O.
│  ├─ contratos/              # Esquemas Zod + tipos compartidos API ↔ dashboard
│  └─ parametros/             # Catálogos versionados (UMA, salario mínimo, tablas, cuotas) en JSON
└─ pnpm-workspace.yaml
```

`packages/calculo` es el corazón: **TypeScript puro, sin dependencias de Mongo, HTTP ni Expo**. Lo usan
la API (autoridad) y el dashboard (vista previa instantánea), así que ambos dan el mismo número.

### 2.2 API hexagonal (`apps/api`)

```
src/
├─ domain/                    # entidades y reglas (importa packages/calculo)
├─ application/               # casos de uso; dependen SOLO de puertos
│  ├─ calcular-semana.ts
│  ├─ generar-prenomina.ts
│  ├─ evaluar-cumplimiento.ts
│  └─ exportar-expediente.ts
├─ ports/
│  ├─ in/                     # interfaces de los casos de uso
│  └─ out/                    # RepositorioChecadas, RepositorioParametros, RepositorioPrenomina,
│                             # RepositorioAuditoria, ServicioReloj, ServicioExportacion, BusEventos
├─ adapters/
│  ├─ in/http/                # Fastify + Zod; JWT de membresía (no de dispositivo)
│  └─ out/
│     ├─ mongo/               # driver oficial `mongodb`; un repositorio por puerto
│     ├─ exportacion/         # CSV, XLSX (exceljs), PDF
│     └─ memoria/             # implementaciones en memoria para pruebas
└─ main.ts                    # composición de dependencias (única parte que conoce todo)
```

Reglas: el dominio no importa `mongodb`, `fastify` ni nada de `adapters`; un caso de uso solo conoce
puertos; los adaptadores no contienen reglas de negocio; toda regla fiscal/laboral vive en
`packages/calculo` y se prueba sin base de datos.

### 2.3 Multi-tenant

Igual que el prompt hexagonal base: `tenantId` en **todo** documento y en **todo** índice, tomado del
contexto de la petición (nunca del body). Un repositorio no puede hacer una consulta sin `tenantId`
(se impone en una clase base y se prueba). Roles: `dueno`, `contador`, `rh`, `coach` (solo lectura de su
equipo), `lectura`.

### 2.4 MongoDB Atlas

- Clúster con **réplica** (Atlas lo trae), **TLS**, **IP allowlist** y usuario de base con permisos
  mínimos. Respaldos continuos activados en producción. Desarrollo: nivel gratuito.
- Colecciones (todas con `tenantId`, `creadoEn`, `actualizadoEn`):

| Colección | Contenido | Índice clave |
|---|---|---|
| `parametros_fiscales` | UMA, salario mínimo, tablas ISR, subsidio, cuotas IMSS; con `vigenteDesde`, `vigenteHasta`, `fuente`, `verificadoPor` | `{ejercicio, tipo, vigenteDesde}` (global, sin tenant) |
| `politicas_tenant` | Límites y opciones del tenant (criterio de tope 5 UMA vs salarios mínimos, criterio IMSS conservador, etc.) | `{tenantId}` |
| `jornadas` | Resultado diario por persona, derivado de checadas: horas, tramos, banderas | `{tenantId, empleadoId, fecha}` único |
| `semanas_calculadas` | Resultado semanal: ordinarias, dobles, triples, descanso, festivo, importes, exento/gravado, `versionParametros`, `hashEntrada` | `{tenantId, empleadoId, semanaISO}` único |
| `prenominas` | Periodo, estado (`borrador`/`revisada`/`cerrada`), totales, hash | `{tenantId, periodo}` |
| `cumplimiento` | Semáforos por área con evidencia y fecha de evaluación | `{tenantId, area, evaluadoEn}` |
| `auditoria` | Quién calculó, cerró o exportó qué (solo inserciones) | `{tenantId, ts}` |

- **Datos personales** (RFC, CURP, NSS): cifrado a nivel de campo (Client-Side Field Level Encryption
  de MongoDB) con llaves en un KMS. Si no se activa, documentar el riesgo y no registrar esos campos en
  logs.
- **Las semanas calculadas son inmutables** una vez que la prenómina se cierra: recalcular crea una
  versión nueva y conserva la anterior (mismo principio que las correcciones por adición del kiosko).
- Toda semana guarda `versionParametros` y `hashEntrada` para poder **reproducir** el cálculo en una
  revisión o juicio.

### 2.5 Dashboard (Expo)

- Expo Router, salida web (`web.output: "single"` o `"static"` según hosting), React Native Web.
- Estado de servidor con TanStack Query; formularios con React Hook Form + Zod (`packages/contratos`).
- Gráficas con una librería compatible con web y móvil (p. ej. `victory`); verificar compatibilidad con la
  versión de Expo del momento antes de fijarla.
- Diseño responsive: tablas densas en escritorio, tarjetas en teléfono. Modo claro/oscuro.
- Cumple accesibilidad básica (contraste, foco, etiquetas) y **nunca depende solo del color**: cada
  semáforo lleva icono y texto.

---

## 3. Pantallas del dashboard

1. **Resumen:** KPIs de la quincena/semana (horas extra totales, costo extra, personas cerca del tope,
   alertas abiertas) y tres semáforos: SAT, IMSS, STPS.
2. **Tiempo extra:** tabla por persona y semana: ordinarias, dobles, triples, descanso trabajado, festivo,
   importe, exento, gravado. Detalle con el desglose paso a paso (sección 4) y las checadas que lo
   originan (folio, hora, si hubo foto).
3. **Prenómina:** vista por periodo con estado y totales; botón "Cerrar periodo" (inmutable) y "Exportar".
4. **SAT / ISR:** exento vs gravado por semana, tope semanal aplicado, ISR marginal estimado de las
   horas extra, datos para el nodo de tiempo extra del CFDI de nómina.
5. **IMSS:** SBC fijo, parte variable del bimestre, tope de 25 UMA, tiempo extra que integra o no,
   **fechas de avisos de modificación** y diferencia de cuotas estimada.
6. **STPS:** jornada semanal vs tope del año, horas extra vs límites, descansos, registro electrónico
   del art. 132 fr. XXXIV, Ley Silla (enlace al módulo del kiosko).
7. **Simulador:** "¿cuánto cuesta una hora extra más para esta persona?" y "¿qué pasa si bajo el tope a
   46 h en 2027?".
8. **Apartados legales:** fuentes, estado de verificación y avisos (sección 10).
9. **Parámetros:** catálogo versionado, quién lo verificó y desde cuándo rige.
10. **Auditoría:** bitácora de cálculos, cierres y exportaciones.

---

## 4. Motor de cálculo (`packages/calculo`)

Todas las funciones son **puras**, reciben dinero en **centavos enteros** (nunca `float`) y devuelven el
desglose, no solo el total. Redondeo: a centavo, `half-up`, al final de cada concepto.

### 4.1 Valor de la hora

```
salarioDiario = salario pactado (o mínimo, el mayor)            ← del módulo de salario negociado
divisor       = 8 (diurna) | 7 (nocturna) | 7.5 (mixta)
valorHora     = salarioDiario / divisor
horaDoble     = valorHora × 2          (el 100 % adicional del art. 67 LFT incluye la hora normal)
horaTriple    = valorHora × 3
```

El tipo de jornada sale del turno asignado. **Para salario fijo** se usa el diario sin integrar (no el SBC).

### 4.2 Clasificación semanal de horas extra

Entradas: horas trabajadas por día, jornada ordinaria diaria, tope semanal del año. Parámetros del
catálogo (con su fuente):

| Parámetro | 2026 | 2027 | 2028 | 2029 | 2030 | Estado |
|---|---|---|---|---|---|---|
| Jornada ordinaria semanal | 48 | 46 | 44 | 42 | 40 | [FUENTE] |
| Horas extra dobles máx./semana | 9 | 9 | 10 | 11 | 12 | [FUENTE] (KPMG, Veritas) |
| Máx. extra por día | 4 | 4 | 4 | 4 | 4 | [FUENTE]: **verificar** (antes de la reforma se citaba 3) |
| Máx. días con extra/semana | 4 | 4 | 4 | 4 | 4 | [FUENTE]: **verificar** |
| Horas triples (art. 68) | exceden el tope doble | | | | | [LEY] el exceso se paga triple |
| Tope absoluto de extra/semana | 13 (2026-27) … 16 (2030) | | | | | [FUENTE] Veritas: la propia fuente reconoce que la autoridad podría opinar distinto |
| Jornada + extra por día | ≤ 12 h | | | | | [FUENTE] |

Algoritmo:

1. Por día: `extraDia = max(0, horasTrabajadas − jornadaDiaria)`.
2. Por semana: acumula `extraSemana`; las primeras `topeDobles` horas son **dobles**; las siguientes,
   **triples**.
3. Marca **banderas** (no bloquea el cálculo): `excedeHorasDia`, `excedeDiasConExtra`,
   `excedeTopeAbsoluto`, `excedeDoceHoras`. Las horas que rebasan los límites siguen pagándose triple
   (el patrón debe pagar lo trabajado), pero quedan **fuera de la exención de ISR** y **dentro del SBC**
   (secciones 4.5 y 4.6).
4. Cada semana guarda el desglose por día.

### 4.3 Otras percepciones ligadas a la jornada

- **Descanso semanal trabajado:** salario del día + pago doble adicional (3× en total) y, si aplica, prima
  dominical del 25 % cuando se labora en domingo. [FUENTE: confirmar artículos con el abogado]
- **Día festivo obligatorio trabajado:** salario del día + pago doble adicional.
- **Prima dominical:** 25 % sobre el salario del día, solo para quien labora en domingo como día ordinario.
- Los tres se calculan en el mismo motor, pero en **conceptos separados**, porque su tratamiento en SAT
  e IMSS no es idéntico al del tiempo extra.

### 4.4 Caso de oro (la tabla compartida)

La imagen muestra 10 horas extra en una semana, con valor hora de **$50**: 9 horas dobles (**$900**) +
1 hora triple (**$150**).

| | 9 horas dobles | 1 hora triple | Total |
|---|---|---|---|
| Pago | $900 | $150 | $1,050 |
| Exento de ISR | $450 (50 %) | $0 | $450 |
| Gravado | $450 | $150 | $600 |

Cuadra con la regla [FUENTE] del art. 93 fr. I LISR: se exenta el 50 % del pago de las **horas dobles**
dentro del límite; las **triples** (exceso) no se exentan. El tope semanal ($586.55 con UMA, sección 4.5)
no se alcanza, porque $450 < $586.55. Este caso es la **prueba de oro #1** del motor.

### 4.5 ISR (SAT)

**Exención del tiempo extra** (por **semana**, art. 93 fr. I LISR [FUENTE]):

```
base_exenta   = suma semanal de: horas dobles dentro de límites + descanso trabajado + festivo trabajado
exento_pot    = 50 % × base_exenta
exento_real   = min(exento_pot, topeSemanal)
gravado       = pagoTotalDeConceptos − exento_real
```

- `topeSemanal`: **5 UMA** (2026: 5 × $117.31 = **$586.55**) o **5 salarios mínimos** (5 × $315.04 =
  **$1,575.20**), según el criterio que el tenant fije en `politicas_tenant`. Valor predeterminado:
  **UMA** (más conservador, mayor ISR). Ver decisión abierta 1.
- Las **horas triples** y las que rebasan los límites laborales **no se exentan**.
- Quien percibe **salario mínimo**: la exención del tiempo extra tiene tratamiento propio y las guías no
  coinciden en si es total. Se implementa como bandera `criterioSalarioMinimo` con valor por defecto
  **sin exención especial** y se marca [PENDIENTE] para el contador.
- Con pagos **quincenales/mensuales** el tope sigue siendo **semanal**: se asigna cada pago a la semana
  en que ocurrió (como hacen las plataformas de nómina), aunque la semana cruce dos periodos.

**ISR a retener:** se calcula con la **tarifa vigente del periodo** (tabla por ejercicio, del catálogo).
Para mostrar el efecto de la hora extra:

```
isrMarginal = ISR(percepcionesGravadasPeriodo) − ISR(percepcionesGravadasPeriodo − gravadoDeExtra)
```

El subsidio para el empleo y cualquier ajuste fiscal del ejercicio se leen del catálogo; **no se
codifican valores**. Si falta la tabla del ejercicio, el sistema **se niega a calcular ISR** y lo dice.

**CFDI de nómina (solo datos, el timbrado lo hace el contador):** exportar, por periodo, los datos que
pide el complemento de nómina para tiempo extra: días, tipo de horas (dobles/triples), horas e importe
pagado, y el importe **gravado y exento** por percepción. Verificar claves y versión en el catálogo
vigente del SAT (la versión del complemento puede cambiar).

### 4.6 IMSS

- **SBC** = fijo + variable. El **tiempo extra dentro de los márgenes de la LFT no integra** al SBC
  (art. 27 fr. IX LSS [LEY]). **Lo que excede se integra.**
- **Ambigüedad:** se discute si el "margen" son solo las dobles (art. 66) o también las triples hasta el
  límite semanal. Predeterminado conservador: **integrar al SBC todo lo que rebase las dobles**, y
  mostrar el escenario alterno. Política configurable en `politicas_tenant.criterioImss`; documentar el
  criterio aplicado.
- **Variables:** el SBC variable se promedia por **bimestre**; la modificación se avisa al IMSS en los
  **primeros cinco días hábiles del bimestre siguiente** [FUENTE: KPMG, citando el caso de julio de 2026
  con el tiempo extra de mayo-junio]. El dashboard calcula la fecha límite.
- **Tope:** 25 UMA diarias (art. 28 LSS [FUENTE]). Si el SBC rebasa, se topa.
- **Cuotas obrero-patronales y aportaciones Infonavit:** porcentajes por ramo desde el catálogo
  versionado (cambian por año, por la reforma de pensiones y por el cálculo de cuota patronal de
  "cesantía y vejez" según el SBC). **No se codifican.**
- Mostrar la **diferencia de cuotas** entre el escenario conservador y el alterno, para que el patrón
  vea el costo de la ambigüedad.

### 4.7 Catálogo de parámetros

Cada registro: `tipo`, `valor`, `ejercicio`, `vigenteDesde`, `vigenteHasta`, `fuenteUrl`, `verificadoPor`,
`verificadoEn`. Valores ya verificados para sembrar:

| Parámetro | Valor | Fuente |
|---|---|---|
| UMA diaria 2026 (desde 1-feb-2026) | $117.31 (mensual $3,566.22, anual $42,794.64) | INEGI, DOF 9-ene-2026 [FUENTE: idconline] |
| Salario mínimo general 2026 | $315.04 | CONASAMI [ya verificado en el prompt de salario negociado] |
| Salario mínimo ZLFN 2026 | $440.87 | ídem |

El sistema avisa cuando un parámetro **no tiene `verificadoPor`** o está vencido, y muestra un banner
rojo en el dashboard.

### 4.8 STPS / laboral (semáforos de cumplimiento)

Reglas puras que devuelven `{estado: verde|ambar|rojo, motivo, evidencia[]}`:

| Regla | Verde | Ámbar | Rojo |
|---|---|---|---|
| Jornada semanal ordinaria | ≤ tope del año | ≥ 90 % del tope | > tope sin pagar extra |
| Extra dobles de la semana | ≤ parámetro | ≥ 80 % | excede (pasa a triple) |
| Extra por día / días con extra | dentro | en el límite | excede |
| Jornada + extra diaria | ≤ 12 h | ≥ 11 h | > 12 h |
| Descanso semanal | respetado | trabajado y pagado | trabajado sin pago |
| Registro electrónico (art. 132 fr. XXXIV) | acuerdo firmado y checadas íntegras (hash) | acuerdo próximo a vencer | sin acuerdo o con huecos de `seq` |
| Ley Silla | semáforo del módulo del kiosko | pendiente de recorrido/evaluación | reporte abierto sin resolver |

Los umbrales ámbar (90 %, 80 %) son **defaults de producto configurables**, no cifras legales.

---

## 5. Datos de entrada (integración con el sistema de asistencia)

- El dashboard no recibe checadas "crudas" de nadie: lee de `jornadas`, que el backend deriva de las
  checadas **íntegras** (cadena de hash válida, sin huecos de `seq`, sin anomalías abiertas). Una
  semana con checadas en cola de validación del coach queda **"provisional"** y no se puede cerrar.
- **Correcciones** del kiosko (evento `correccion`) se aplican en el cálculo, nunca sobre la checada
  original; la bitácora conserva ambos.
- El **salario** viene del módulo de salario pactado (con aceptación y su historia). Si cambió dentro de
  la semana, el cálculo se parte por días con su salario vigente.

---

## 6. Rutas de la API (`/api/v1`, JWT de membresía)

```
GET   /dashboard/resumen?desde=&hasta=
GET   /tiempo-extra/semanas?empleadoId=&desde=&hasta=
GET   /tiempo-extra/semanas/:id/desglose
POST  /tiempo-extra/simulaciones                { empleadoId, horasExtra, tipoJornada, fecha }
GET   /prenominas                                 POST /prenominas            { periodo }
POST  /prenominas/:id/cerrar                      GET  /prenominas/:id/exportar?formato=csv|xlsx|json
GET   /cumplimiento/sat|imss|stps
GET   /cumplimiento/stps/ley-silla                (resume el módulo ya definido)
GET   /imss/avisos-pendientes
GET   /parametros                                 POST /parametros            (solo rol contador/dueno)
GET   /auditoria
GET   /apartados-legales
```

Todas las respuestas de cálculo incluyen `versionParametros`, `hashEntrada` y el **desglose**. Errores
con código estable (`PARAMETRO_FALTANTE`, `SEMANA_PROVISIONAL`, `PERIODO_CERRADO`).

---

## 7. Pruebas obligatorias

**Unitarias de `packages/calculo`** (sin base de datos, ejecutables en CI):

1. **Prueba de oro #1** (4.4): valor hora $50, 9 dobles + 1 triple → pago $1,050, exento $450, gravado $600.
2. **Tope semanal:** total de conceptos exentables $1,875 → exento = min($937.50, $586.55) = **$586.55**;
   gravado $1,288.45.
3. **Valor hora:** salario diario $400: diurna $50, nocturna $57.14, mixta $53.33.
4. **Redondeo:** nunca `float`; sumas en centavos.
5. **Semana que cruza periodo:** el tope se aplica a la semana completa.
6. **Cambio de año de jornada:** una misma persona con 47 h el 31-dic-2026 y el 1-ene-2027 usa el tope
   que corresponde a cada fecha.
7. **Faltan tablas ISR del ejercicio:** el sistema devuelve `PARAMETRO_FALTANTE` y no inventa un número.
8. **Escenario IMSS conservador vs alterno:** ambos se calculan y su diferencia coincide.
9. **Semana provisional** no se puede cerrar.
10. **Aislamiento multi-tenant:** un usuario del tenant A no puede leer semanas del B (prueba a nivel de
    repositorio y de ruta).
11. **Inmutabilidad:** tras cerrar un periodo, recalcular genera versión nueva y conserva la anterior.

**Gherkin base** (añadir al `.feature` del proyecto):

```gherkin
# language: es
Característica: Cálculo de tiempo extra y exención de ISR

  Escenario: Horas dobles y triples con exención del 50 %
    Dado un valor de hora de $50 y 10 horas extra en la semana
    Y un tope doble semanal de 9 horas
    Cuando se calcula la semana
    Entonces se pagan $900 de horas dobles y $150 de horas triples
    Y el ISR exento es $450 y el gravado es $600

  Escenario: El tope semanal limita la exención
    Dado que la base exentable de la semana es de $1,875
    Cuando se aplica el tope de 5 UMA
    Entonces el exento es $586.55 y el gravado $1,288.45

  Escenario: El sistema no calcula sin tablas vigentes
    Dado que no existen tablas de ISR del ejercicio actual
    Cuando se pide la retención estimada
    Entonces el sistema responde "PARAMETRO_FALTANTE" y no devuelve importe

  Escenario: Semana con checadas pendientes no se cierra
    Dado que hay una checada en la cola de validación del coach
    Cuando se intenta cerrar la prenómina
    Entonces se rechaza con "SEMANA_PROVISIONAL"
```

**Contrato:** las respuestas de la API validan contra `packages/contratos`.

---

## 8. Seguridad

- JWT de membresía con expiración corta, refresh rotativo; contraseñas con argon2.
- Autorización por rol **en el caso de uso**, no solo en la ruta.
- Cifrado en tránsito (TLS) y de campos sensibles (sección 2.4). Sin RFC/CURP/NSS en logs.
- Auditoría de solo inserción de cada cálculo, cierre y exportación.
- Límite de tasa en rutas de exportación y autenticación.
- Respaldos de Atlas probados con una restauración real antes de producción.

---

## 9. Plan por hitos

| Hito | Entrega | Criterio de aceptación |
|---|---|---|
| D0 | Monorepo, CI, `packages/calculo` con tiempo extra y casos de oro | Pruebas 1–5 en verde |
| D1 | Catálogo de parámetros versionado + banner de no verificado | Prueba 7 |
| D2 | API hexagonal + adaptador Mongo + multi-tenant | Pruebas 10–11 |
| D3 | ISR (exención, marginal) y exportación de datos para CFDI | Pruebas 2, 5, 6 |
| D4 | IMSS (SBC variable, avisos, escenarios) | Prueba 8 |
| D5 | Semáforos STPS e integración con checadas del kiosko | Prueba 9 |
| D6 | Dashboard Expo web: resumen, tiempo extra, prenómina | Revisión con un contador real |
| D7 | Simulador, auditoría, apartados legales, exportaciones | Revisión legal de los textos |
| D8 | Ajuste a las disposiciones de la STPS (esperadas en dic-2026) y a criterios IMSS/SAT nuevos | Checklist firmado |

---

## 10. Apartados legales

### 10.1 Marco normativo y estado de verificación

| Tema | Qué dice | Fuente | Estado |
|---|---|---|---|
| Registro electrónico de jornada | Art. 132 fr. XXXIV LFT: registrar inicio y fin de jornada de cada persona; entregarlo a la autoridad; prueba plena si fue acordado. Exigible desde 1-ene-2027; multas de 250 a 5,000 UMA. | LFT en Justia; Veritas | [LEY] el texto; [FUENTE] multa y fecha |
| Tiempo extra doble | Art. 66 LFT: 100 % adicional dentro del límite; tope semanal escalonado 9 / 10 / 11 / 12 h (2026-27 / 2028 / 2029 / 2030). | KPMG, Veritas (reforma DOF 1-may-2026) | [FUENTE] |
| Tiempo extra triple | Art. 68 LFT: el exceso se paga con 200 % adicional. | Veritas | [FUENTE] |
| Límites diario y de días | Se citan 4 h/día y 4 días/semana tras la reforma; antes de ella se citaban 3 y 3. | KPMG, Veritas | **[PENDIENTE]**: verificar texto vigente |
| Exención ISR del tiempo extra | Art. 93 fr. I LISR: 50 % exento, con tope semanal; no se exentan horas triples ni excedentes. | yo-facturo, Buk, Veritas | [FUENTE]: cotejar texto y la unidad del tope (UMA vs salario mínimo) |
| SBC y tiempo extra | Art. 27 fr. IX LSS: no integra el tiempo extra dentro de los márgenes de la LFT; el exceso sí. La LSS no cambió con la reforma. | LSS (sdv), KPMG | [LEY] el texto; [FUENTE] la interpretación del "margen" |
| Tope del SBC | 25 UMA (art. 28 LSS). | sdv (resumen) | [FUENTE] |
| UMA 2026 | $117.31 diaria desde 1-feb-2026 (DOF 9-ene-2026). | idconline / INEGI | [FUENTE] |
| Ley Silla | Art. 133 fr. XVII Bis y disposiciones STPS del 17-jul-2025. Ver `prompt-kiosko-asistencia-expo.md`, sec. 11 bis. | EY, Basham | [FUENTE] |
| Disposiciones STPS del registro | Reglas técnicas aún no publicadas al 29-oct-2026; se esperan en la primera quincena de dic-2026. | Prensa y despachos | **[PENDIENTE]** |
| Datos personales | Nueva LFPDPPP (DOF 20-mar-2025): consentimiento expreso y por escrito para datos sensibles; aviso de privacidad; derechos ARCO; autoridad: Secretaría Anticorrupción y Buen Gobierno. | Texto de Diputados | [LEY] (lectura automatizada: confirmar con abogado) |

### 10.2 Avisos que debe mostrar el producto

1. **"Estimación de pre-nómina, no es timbrado ni asesoría fiscal o legal."** Visible en el dashboard y en
   cada exportación.
2. **Parámetros sin verificar** o vencidos: banner persistente con el nombre del parámetro.
3. **Criterios en disputa** (tope de exención, margen del SBC, salario mínimo): el sistema muestra el
   criterio aplicado y el escenario alterno.
4. **Fecha de última revisión legal** de este módulo.
5. **Quién verificó** cada parámetro y cuándo.

### 10.3 Obligaciones del patrón que el sistema ayuda a evidenciar (no a sustituir)

- Pagar el tiempo extra efectivamente trabajado, aunque no esté autorizado (el sistema lo registra y lo
  paga; la autorización es un tema de gestión).
- Llevar el registro electrónico con el acuerdo firmado de cada persona.
- Avisar al IMSS las modificaciones de salario variable en plazo.
- Conservar el expediente (sin plazo fijo conocido en las fuentes leídas): **retención configurable**
  por tenant, sin valor por defecto hasta que legal lo defina.
- Cumplir Ley Silla (módulo del kiosko).

### 10.4 Lo que el sistema NO hace

- No timbra CFDI de nómina, no presenta declaraciones, no envía avisos al IMSS ni al Infonavit.
- No determina la naturaleza jurídica de una relación laboral.
- No decide por el patrón criterios jurídicos en disputa: los expone y registra el elegido.
- No sustituye al contador ni al abogado laboralista.

### 10.5 Revisión obligatoria antes de producción

1. Abogado laboral: límites diarios/semanales del tiempo extra, descanso trabajado, texto del acuerdo
   de registro y plazos de conservación.
2. Contador: tope de exención (UMA vs salario mínimo), tablas de ISR y subsidio del ejercicio, y datos
   del CFDI de nómina.
3. Responsable de seguridad social: criterio del "margen" para el SBC y escenario predeterminado.
4. Protocolo de actualización: cada vez que se publique algo en el DOF (STPS, SAT, IMSS), se revisan
   los parámetros y se registra la versión nueva con su verificador.

---

## 11. Decisiones abiertas (confirmar con el humano antes de construir)

1. **Tope de la exención de ISR:** ¿5 UMA (predeterminado, conservador) o 5 salarios mínimos?
2. **Criterio IMSS:** ¿integrar al SBC todo lo que rebase las dobles (predeterminado) o solo lo que rebase
   el tope absoluto semanal?
3. **Límites 3/3 vs 4/4:** cotejar el texto vigente del art. 66 antes de fijar los valores iniciales.
4. **Salario mínimo y exención:** ¿criterio predeterminado? Requiere contador.
5. **Alcance de la v1:** ¿solo semanal y quincenal, o también mensual y catorcenal?
6. **Timbrado:** ¿se integra un PAC en una fase posterior o la prenómina solo se exporta?
7. **Hosting del dashboard:** Expo web estático (más barato) vs servidor Node que lo sirva.
8. **Cifrado a nivel de campo en Atlas:** ¿se activa desde v1?

---

## 12. Instrucciones de trabajo para el agente

1. Empieza por `packages/calculo` y sus pruebas (hitos D0–D1) **antes** de tocar Mongo o Expo.
2. No codifiques UMA, salarios mínimos, tablas ni cuotas: van al catálogo versionado.
3. No uses `float` para dinero. No inventes fórmulas fiscales: si falta la regla, devuelve
   `PARAMETRO_FALTANTE` y pregunta.
4. Cuando una fuente contradiga a otra, no elijas en silencio: implementa ambos escenarios, marca el
   conservador y agrega la duda a la sección 11.
5. Cada hito cierra con pruebas en verde y la lista de pendientes legales actualizada.
6. No afirmes en la interfaz que algo "cumple con la ley": usa "estimación" y "evidencia".

---

# PARTE 5 — Integridad verificable: Merkle + ZK y reparto Android / Web

<!-- origen: prompt-integridad-merkle-zk-android-web.md -->

# Prompt — Integridad verificable (Merkle + ZK) y reparto de estadísticas Android / Web

> Complementa `prompt-kiosko-asistencia-expo.md` (Android) y `prompt-dashboard-nomina-legal-web.md`
> (web). Define **qué se calcula y se muestra en cada lado** y agrega **árboles de Merkle** (v1) y
> **pruebas de conocimiento cero** (fase 2).
> Revisión: 31-oct-2026. **No es asesoría legal.** Etiquetas: **[LEY]** leído · **[FUENTE]** reporte
> sin cotejar · **[PENDIENTE]** sin confirmar · **[DISEÑO]** decisión técnica nuestra.

---

## 0. Qué hacen (y qué no) Merkle y ZK aquí

| Herramienta | Qué demuestra | Qué NO demuestra |
|---|---|---|
| Cadena de hash (ya existe) | Que nadie cambió ni borró checadas intermedias de **un dispositivo** | Que la checada ocurrió de verdad ni quién estaba frente al kiosko |
| **Árbol de Merkle** | Que una checada concreta pertenece a un lote cuya **raíz** se fijó en cierto momento, **sin revelar las demás** | Veracidad del evento; ni valor legal por sí mismo |
| **ZK** | Que un cálculo sobre datos privados es correcto (p. ej. "las horas de la semana ≤ tope") **sin revelar los datos** | Que los datos de entrada sean ciertos: solo prueba coherencia con lo comprometido |

Postura honesta:
- **[LEY]** El art. 132 fr. XXXIV LFT pide un registro electrónico y le da prueba plena **si se acredita que
  fue acordado**. Ni la ley ni las fuentes leídas exigen Merkle ni ZK. Son **refuerzo técnico** para
  poder explicar en juicio qué se registró, cuándo y que no se alteró.
- Una raíz de Merkle anclada fuera del sistema (sello de tiempo) vuelve **muy difícil negar o
  retroactivar** una checada; no sustituye el acuerdo firmado ni la revisión de un perito.
- **No afirmes en la app, el flyer ni la web que "la ley exige blockchain, Merkle o ZK" ni que esto
  "garantiza la validez legal".** Texto permitido: "evidencia verificable de que el registro no fue
  modificado".
- ZK **no es v1**: se agrega solo para enunciados concretos (sección 5). Si no resuelve un problema real
  de privacidad o confianza, no se construye.

---

## 1. Reparto Android vs Web

| | **Android (kiosko)** | **Web (dashboard)** |
|---|---|---|
| Rol | **Capturar, sellar y mostrar lo mínimo** | **Calcular, analizar y probar** |
| Fuente de verdad | Checadas locales con hash y `seq` | Checadas sincronizadas e íntegras |
| Cálculo fiscal/laboral | **Ninguno vinculante** | **Todo** (`packages/calculo`) |
| Estadísticas | Contador simple y local | Tablero completo, simulador, semáforos |
| Merkle | Genera **hojas** y **recibo** | Construye **árboles**, ancla raíces, verifica y exporta pruebas |
| ZK | Nada pesado | Genera/verifica pruebas (servidor) |
| Conexión | Debe funcionar sin red | Requiere red |

Razón: el kiosko es un teléfono viejo (Android 7+, 2 GB). Calcular ISR o generar pruebas ZK ahí es
frágil y lento. El kiosko hace solo operaciones baratas y deterministas (SHA-256).

### 1.1 Estadísticas en Android (v1, todas **offline** y solo informativas)

Con PIN, el colaborador ve:
1. **"Mi semana":** horas trabajadas estimadas hasta ahora y días con checada completa.
2. **Barra frente al tope ordinario del año** (48 h en 2026, 46 en 2027 [FUENTE]), con el aviso fijo:
   *"Cálculo estimado. El oficial lo emite tu empresa."*
3. **Checadas de los últimos 14 días** con folio y estado de sync (ya definido).
4. **Recibo con código QR** de su última checada (sección 3.3).

El kiosko **no** muestra ISR, IMSS, pagos ni importes de horas extra. Razones: (a) esos cálculos dependen
de parámetros versionados y de criterios en disputa (ver prompt del dashboard); (b) mostrar dinero en un
equipo compartido expone datos salariales.

Para el administrador, en modo PIN de admin: contadores del día (checadas, pendientes de sync, anomalías).

### 1.2 Estadísticas en Web (v1)
Todo lo del prompt del dashboard: tiempo extra, prenómina, SAT, IMSS, STPS, simulador, auditoría, más
la **pantalla "Integridad"** (sección 4): estado de raíces, anclajes, verificación y exportación de
pruebas.

---

## 2. Compromisos criptográficos [DISEÑO]

- Hash: **SHA-256** en todo (disponible con `expo-crypto`).
- **Codificación canónica obligatoria** de cada checada antes de hashearla (JSON con claves ordenadas,
  UTF-8, sin espacios, enteros en vez de floats, tiempos en milisegundos UTC). Un solo módulo
  `packages/integridad` la implementa y lo usan Android y backend, con vectores de prueba compartidos.
- **Separación de dominios** (evita confundir una hoja con un nodo):
  `hoja = SHA256(0x00 ‖ checadaCanonica)`; `nodo = SHA256(0x01 ‖ izq ‖ der)`.
- **Privacidad:** la hoja **no contiene** nombre, foto ni coordenadas en claro. Lleva `empleadoRef`
  (identificador opaco), `tipo`, `ts`, `dispositivoId`, `seq`, `hashFoto` y un **salt aleatorio por
  checada** guardado solo en la checada. Sin el salt, un tercero no puede adivinar el contenido probando
  valores.
- Si algún día se incluye ubicación, va solo como **compromiso** (`SHA256(salt ‖ geohash)`), nunca en
  claro dentro de la prueba.

---

## 3. Parte Android (kiosko)

### 3.1 Qué agrega
Al guardar cada checada (ya con `seq`, `hashAnterior` y `hash` de cadena), calcula también:
`hojaMerkle` y guarda `salt`. Nada más cambia en el flujo del usuario.

### 3.2 Esquema local (añadir a `checadas`)
`salt`, `hojaMerkle`, `loteId` (nullable hasta que el servidor lo asigne), `pruebaInclusion` (JSON,
nullable), `raizLote` (nullable), `anclaje` (nullable).

### 3.3 Recibo verificable
Tras checar, la pantalla puede mostrar (config del tenant `mostrarRecibo`) un **QR** con:
`{ v, tenantId, dispositivoId, seq, tipo, ts, hojaMerkle }`. Sirve para que el colaborador **conserve
evidencia** (foto con su celular) y luego verifique que su checada aparece en el árbol. **No incluye
nombre ni datos personales.** Es opcional y se desactiva si el aviso de privacidad no lo cubre.

### 3.4 Sincronización
`checadas/lote` ya envía las checadas. El servidor responde por checada: `loteId`, `raizLote`,
`pruebaInclusion` y, cuando exista, `anclaje`. El kiosko los **guarda para mostrarlos** y, si puede,
**verifica localmente** la prueba (recalcular hasta la raíz es barato: ~log₂ n hashes). Si la verificación
falla, marca la checada `verificacion_fallida` y avisa al administrador; **nunca** la borra.

### 3.5 Lo que Android NO hace
Generar pruebas ZK, construir el árbol del lote, hablar con servicios de sello de tiempo ni calcular
nómina. Tampoco guarda llaves privadas de anclaje.

### 3.6 Pruebas (Android)
1. Vector de oro: la misma checada produce **el mismo hash** en Android y en el backend.
2. Cambiar un byte de la checada cambia la hoja.
3. Sin red: checa, genera hoja y recibo; al sincronizar recibe prueba válida.
4. Una prueba alterada marca `verificacion_fallida` y no borra datos.
5. El recibo QR no contiene nombre, foto ni coordenadas.

---

## 4. Parte Web (backend + dashboard)

### 4.1 Construcción de árboles
- **Lotes diarios por tenant** (configurable): al cierre del día se arma un **árbol de Merkle** con todas
  las hojas válidas de ese día, ordenadas por `(dispositivoId, seq)`.
- Árbol **binario**, hojas impares se emparejan con un nodo vacío definido en la especificación (nunca
  duplicando la hoja, para evitar ambigüedad).
- Se guarda en `lotes_merkle`: `loteId`, `fecha`, `raiz`, `nHojas`, `version`, `creadoEn`, y el estado
  del anclaje. Las hojas y las pruebas se pueden regenerar de las checadas.
- **Un lote cerrado no se modifica.** Una corrección entra al lote del día siguiente como evento
  `correccion`, igual que en el kiosko.
- **Raíz de raíces:** cada semana y cada periodo de nómina se calcula un árbol sobre las raíces diarias.
  La prenómina cerrada guarda esa raíz, de modo que **el cálculo de nómina queda atado a las checadas
  que lo originaron**.

### 4.2 Anclaje externo (sello de tiempo)
Una raíz solo tiene valor si se **fija fuera de tu control**. Opciones por orden de simplicidad
[DISEÑO]:

1. **Correo firmado** de la raíz al dueño y al contador (barato; evidencia débil).
2. **Servicio de sellado de tiempo (TSA, RFC 3161)** de un tercero. Verificar con el abogado si algún
   prestador reconocido en México aporta valor probatorio extra [PENDIENTE]; en México existe el
   marco de la **NOM-151-SCFI** para conservación de mensajes de datos con constancias de un prestador
   autorizado [FUENTE: confirmar vigencia y alcance con abogado].
3. **OpenTimestamps** o ancla en una **blockchain pública** (sin datos personales: solo la raíz).
4. Combinar 2 y 3.

La v1 implementa el puerto `ServicioAnclaje` con **adaptadores intercambiables** y arranca con el
correo firmado + OpenTimestamps. El adaptador de un prestador certificado entra cuando el abogado lo
indique. Nunca se publican datos personales: solo la raíz.

### 4.3 Verificación y exportación
- **Pantalla "Integridad":** semáforo por día (raíz calculada, anclada, verificada), alertas por
  `seq` con huecos, cadenas rotas o raíces sin ancla.
- **Verificador independiente:** un script de código abierto (`verificar-prueba`) que, con la checada, la
  prueba de inclusión y la raíz anclada, confirma pertenencia **sin acceso al sistema**. Debe poder
  correr en un navegador o en Node, sin dependencias del backend.
- **Expediente para autoridad o juicio:** exportación por periodo con checadas, pruebas de inclusión,
  raíces, anclajes, el acuerdo firmado de cada persona y el hash de la política vigente.
- Estadísticas de integridad: % de checadas con prueba verificada, tiempo medio hasta anclaje, huecos
  detectados, correcciones por mes.

### 4.4 Puertos nuevos (arquitectura hexagonal)
`ConstructorArbolMerkle` (dominio puro), `RepositorioLotes`, `ServicioAnclaje`,
`VerificadorPruebas`, `GeneradorPruebasZk` (fase 2). Mongo: colecciones `lotes_merkle` y `anclajes`,
ambas **solo inserción**, con índice `{tenantId, fecha}`.

### 4.5 Rutas
```
GET  /api/v1/integridad/resumen?desde=&hasta=
GET  /api/v1/integridad/lotes/:loteId
GET  /api/v1/integridad/checadas/:id/prueba
POST /api/v1/integridad/lotes/:loteId/anclar
GET  /api/v1/integridad/expediente?desde=&hasta=
POST /api/v1/integridad/verificar          { checada, prueba, raiz }
```
Para el kiosko: `checadas/lote` devuelve `loteId` y prueba cuando el lote ya cerró; si no, la entrega
`GET /api/v1/dispositivos/checadas/:uuid/prueba` en una sincronización posterior.

### 4.6 Pruebas (Web)
1. **Vectores de Merkle:** 1, 2, 3, 4, 5 y 1,000 hojas; la prueba de cualquier hoja reconstruye la raíz.
2. **Resistencia:** cambiar una hoja, el orden o un nodo intermedio invalida la prueba.
3. **Separación de dominios:** una hoja no puede hacerse pasar por un nodo interno.
4. **Lote cerrado inmutable:** insertar una checada tardía la envía al lote siguiente.
5. **Prenómina atada:** modificar una checada cambia la raíz y la prenómina cerrada lo detecta.
6. **Verificador independiente:** valida sin acceso a la base ni al backend.
7. **Aislamiento multi-tenant** en lotes y pruebas.

---

## 5. ZK (fase 2, solo enunciados concretos)

### 5.1 Cuándo tiene sentido
Cuando alguien necesita **comprobar un hecho sin ver los datos**. Candidatos reales:

| Enunciado | Quién verifica | Por qué ZK |
|---|---|---|
| "Mis horas semanales ≤ tope legal del año" | Auditor, contador externo, autoridad | No revelar cada checada ni los horarios |
| "Esta nómina de tiempo extra se calculó con la regla pública sobre checadas comprometidas en la raíz R" | Contador / tercero | Verificar el cálculo sin entregar el expediente completo |
| "Esta persona pertenece al conjunto de colaboradores activos del tenant" | Un tercero (p. ej. cliente final) | No revelar la plantilla |
| "La checada ocurrió dentro del geocerca de la sucursal" | Auditor | No publicar coordenadas |

### 5.2 Cuándo NO
- No sustituye la prueba de que alguien **estuvo presente**: ZK solo prueba coherencia de los datos
  comprometidos, no que sean ciertos.
- No lo uses para algo que una exportación normal con acuerdo firmado resuelve.
- No lo pongas en el dispositivo Android: demostrar en un teléfono de 2 GB es lento y frágil.

### 5.3 Diseño [DISEÑO]
- **Compromiso público:** raíz de Merkle del lote (sección 4). Las pruebas hablan de "hojas dentro de la
  raíz R".
- **Sistema de pruebas:** evaluar entre **Groth16/PLONK vía circom + snarkjs** y **Noir**; elegir con una
  prueba de concepto (tamaño, tiempo, mantenimiento). **No fijar la librería antes del PoC** y verificar
  versiones vigentes al momento.
- **Circuito de ejemplo 1 (horas semanales):** entradas privadas: hojas de la semana con sus tiempos y
  rutas de Merkle; públicas: raíz R, semana, tope. Verifica pertenencia, suma de duraciones ≤ tope.
- **Circuito de ejemplo 2 (tiempo extra):** reglas del motor de cálculo implementadas como circuito;
  la raíz de la prenómina es entrada pública. Cualquier cambio de parámetros (UMA, tope) **versiona** el
  circuito.
- **Dónde se prueba:** en el **servidor** o en el navegador del dueño. Nunca en el kiosko.
- **Confianza del setup:** si el sistema elegido requiere ceremonia de confianza (Groth16), documentar
  quién la hizo; PLONK/Noir con setup universal reduce ese riesgo.
- **Revisión:** los circuitos requieren **revisión de un criptógrafo** antes de usarse como evidencia.

### 5.4 Pruebas (ZK)
1. Una semana válida produce prueba que **verifica**; una semana con 49 h (tope 48) **no puede probarse**.
2. Cambiar un dato privado invalida la prueba.
3. La prueba no filtra horarios ni nombres (revisión manual del *public input*).
4. El verificador es independiente del backend.

---

## 6. Apartados legales de esta capa

| Tema | Postura | Estado |
|---|---|---|
| Registro electrónico y prueba plena | Prueba plena solo si se acredita el acuerdo; Merkle/ZK no lo sustituyen | [LEY] |
| Merkle/ZK/blockchain | La ley y las fuentes leídas **no los exigen** ni los mencionan | [LEY] + [FUENTE] |
| Constancias de conservación (NOM-151) y sellos de tiempo | Evaluar con abogado si aportan peso probatorio y qué prestador | [PENDIENTE] |
| Datos personales | Las raíces y hojas no llevan datos en claro; el salt evita adivinar; la foto y datos viven en el sistema, no en cadenas públicas | [DISEÑO] + revisión LFPDPPP |
| Derecho de supresión (ARCO) | Una raíz anclada no se puede "borrar"; por eso solo se ancla la raíz (sin datos personales) y se documenta que la supresión de la checada no cambia la raíz histórica | [PENDIENTE]: validar con abogado |
| Retención | Configurable por tenant, sin valor por defecto hasta que legal lo defina | [PENDIENTE] |
| Texto prohibido | No decir que el sistema "cumple la ley", que es "a prueba de manipulación" ni que la STPS lo avala | Regla de producto |

**Revisión previa a producción:** abogado laboral (valor probatorio y conservación), abogado de datos
personales (ARCO vs anclaje), criptógrafo (circuitos ZK) y contador (que la raíz de la prenómina
corresponda al expediente fiscal).

---

## 7. Plan por hitos

| Hito | Lado | Entrega | Aceptación |
|---|---|---|---|
| I0 | Ambos | `packages/integridad`: codificación canónica, hoja, nodo, vectores de oro | Pruebas 3.6-1 y 4.6-1 a 4.6-3 |
| I1 | Android | Hoja + salt + recibo QR + guardado de prueba | 3.6-1 a 3.6-5 |
| I2 | Web | Lotes diarios, raíz semanal y de periodo, rutas | 4.6-1 a 4.6-5 |
| I3 | Web | Anclaje (correo firmado + OpenTimestamps), pantalla "Integridad" | 4.6-6 y 4.6-7 |
| I4 | Web | Expediente exportable + verificador independiente | Un tercero verifica sin acceso al sistema |
| I5 | Web | PoC de ZK (circuito de horas semanales) | Pruebas ZK 1 a 4, informe de rendimiento |
| I6 | Ambos | Revisión legal y de criptografía, ajuste a disposiciones STPS | Checklist firmado |

---

## 8. Decisiones abiertas

1. ¿El recibo QR se activa por defecto o solo bajo petición del tenant?
2. ¿Qué mecanismo de anclaje arranca en v1 (correo + OpenTimestamps) y cuándo se integra un prestador
   certificado?
3. ¿Frecuencia del lote: diario (propuesto), por turno o por hora?
4. ¿Se justifica ZK con el costo de mantener circuitos, o basta con Merkle + expediente exportable?
5. ¿Cómo se resuelve el choque entre "no se puede borrar una raíz anclada" y el derecho de supresión?
6. ¿Cuántos meses se conservan hojas, pruebas y salts?

## 9. Instrucciones para el agente

1. Empieza por `packages/integridad` y sus vectores de oro compartidos; sin ellos, Android y backend
   divergen en silencio.
2. No hagas criptografía propia: usa SHA-256 estándar y librerías mantenidas; verifica versiones al
   momento.
3. Merkle primero; ZK solo tras el PoC del hito I5 y la decisión 4.
4. Nunca publiques ni anclas datos personales: solo raíces.
5. Marca en la interfaz lo que es **evidencia técnica** y evita cualquier lenguaje de "validez legal
   garantizada".

---

# PARTE 6 — Prompt del flyer de Instagram (ElevenLabs) y texto del post

**Configuración:** modelo `gpt-image-2`, formato 4:5, 1080×1350 px, calidad media. El texto exacto va entre comillas porque el modelo lo reproduce mejor así.

**Notas:** la pantalla del teléfono es una ilustración con el estilo del mockup, no una captura real; no incluyas insignias de tiendas ni sellos oficiales (agrégalos aparte con las versiones oficiales). El texto superior dice "obligatorio desde el 1 de enero de 2027" porque hoy aún no es exigible y la STPS no publica sus reglas técnicas.

## 6.1 Prompt de imagen

```text
Instagram feed ad, vertical 4:5 portrait, for Mexican small-business owners. Intended use: attendance-app download call-to-action, urgent but credible and professional.

Layout, top to bottom:
- Top: small spaced caps line, white.
- Big three-line headline, bold condensed sans-serif uppercase, very large, dominating the top third.
- Directly below the headline, centered, overlapping the top edge of the phone slightly: a rounded indigo-purple pill badge with a small clock icon and bold white uppercase text, clearly readable, same typeface family as the headline.
- Center and lower-center: a modern smartphone, slightly tilted, held in front of the scene (no hands, no face), with a soft indigo and amber glow behind it. The phone screen shows a dark-mode attendance app: dark navy screen, a greeting at the top, concentric green rings around a map-pin icon inside a circle, a mint green caption under the rings, a large rounded indigo-purple button with a face-scan icon, and below it a short list with three rows (entry, meal, exit) with small icons, and a bottom tab bar with 5 small icons. Clean, minimal, high-fidelity UI.
- Bottom: a bold strap line on a red rounded banner and a tiny footer, with a small empty rounded rectangle reserved for a logo in the bottom-right corner (no logo drawn).

Background: deep navy-black with a subtle blueprint grid; amber and signal-red accents; faint floating calendar-page and shield-with-checkmark icons behind the phone. Flat modern vector-poster style with soft glow.

EXACT TEXT, verbatim, Spanish with accents and inverted punctuation, no extra characters, no substitutions:
1. Top small caps, white: "OBLIGATORIO DESDE EL 1 DE ENERO DE 2027"
2. Headline in three lines, white except line 3 in amber: "¡BAJA LA APP" / "Y CUMPLE" / "DESDE AHORA!"
3. Pill badge below the headline, white on indigo: "APP DE ASISTENCIA"
4. On the phone screen only these texts: "Hola, Renata" at the top, "Sucursal Roma · dentro de geocerca" in mint green, and on the button "Verificar rostro y registrar". Any other tiny UI text may be abstract lines, not words.
5. Bottom strap line, bold white on a red rounded banner: "ANTICÍPATE Y EVITA MULTAS"
6. Tiny footer, light grey: "Art. 132, fracción XXXIV · LFT"

Constraints: no Apple or Google store badges or logos, no real brand names, no government seals or official emblems, no STPS or SAT logos, no people's faces, no watermark, no other text.
```

## 6.2 Texto del post (copiar y pegar)

```text
🚨 ¡Baja la app y cumple desde ahora!

A partir del 1 de enero de 2027 será obligatorio llevar el registro electrónico de entrada y salida de tu equipo (Ley Federal del Trabajo, art. 132, fracc. XXXIV).

⏳ Quedan pocas semanas. Anticípate y evita multas:
✅ Registro con GPS y verificación facial
✅ Evidencia clara para ti y para tu equipo
✅ Funciona incluso sin internet
✅ Listo para tus revisiones de horas extra

👉 Descarga la app hoy y empieza a registrar sin presión.

Información general, no es asesoría legal. Consulta a tu abogado o contador.

#LeyFederalDelTrabajo #RegistroDeAsistencia #PyMEsMéxico #Nómina #Cumplimiento #RH
```

---

# PARTE 7 — Apéndice: features (Gherkin)

Archivo `asistencia-biometrica-gps.feature`. Los umbrales de Ley Silla (asientos vs. puestos, pausa a las 2 h) son **defaults de producto configurables**, no requisitos legales.

```gherkin
# language: es

Característica: Sistema de asistencia por GPS y biometría
  Como dueño de un comercio (patrón)
  Quiero que la entrada y salida de mis colaboradores quede verificada por geolocalización y biometría
  Para eliminar la posibilidad de disputas sobre si la asistencia fue real

  Antecedentes:
    Dado que existe la sucursal "Sucursal Roma" con geocerca de 60 metros
    Y existe la sucursal "Sucursal Condesa" con geocerca de 70 metros
    Y existe el turno "Mostrador AM" de tipo "diurna" de 09:00 a 17:00 en "Sucursal Roma"
    Y el colaborador "Renata Solís" con rol "empleado" está asignado al turno "Mostrador AM"
    Y "Renata Solís" tiene su biometría facial enrolada


  Regla: El check-in solo se habilita dentro del radio de geocerca de la sucursal asignada

    Escenario: Colaborador fuera de la geocerca no puede registrar entrada
      Dado que "Renata Solís" abre la app de asistencia
      Y su ubicación GPS está a 340 metros de "Sucursal Roma"
      Cuando intenta registrar su entrada
      Entonces el botón de registro permanece deshabilitado
      Y se muestra el mensaje "Fuera de rango"

    Escenario: Colaborador dentro de la geocerca puede iniciar el registro
      Dado que "Renata Solís" abre la app de asistencia
      Y su ubicación GPS está a 22 metros de "Sucursal Roma"
      Cuando intenta registrar su entrada
      Entonces el botón de registro se habilita
      Y se le solicita la verificación biométrica antes de sellar el registro


  Regla: Un colaborador puede estar asignado a más de una sucursal

    Escenario: Detección automática cuando solo una geocerca está en rango
      Dado que "Marco Tello" está asignado a "Sucursal Roma" y "Sucursal Condesa"
      Y su ubicación GPS está a 40 metros de "Sucursal Roma"
      Y su ubicación GPS está a 500 metros de "Sucursal Condesa"
      Cuando el sistema evalúa su ubicación
      Entonces se selecciona automáticamente "Sucursal Roma" como sucursal del check-in

    Escenario: Confirmación manual cuando dos geocercas se traslapan
      Dado que "Marco Tello" está asignado a "Sucursal Roma" y "Sucursal Condesa"
      Y su ubicación GPS está a 45 metros de "Sucursal Roma"
      Y su ubicación GPS está a 60 metros de "Sucursal Condesa"
      Cuando el sistema evalúa su ubicación
      Entonces se le muestran ambas sucursales para que confirme en cuál se encuentra
      Y el check-in no se habilita hasta que elige una

    Escenario: Registro en una sucursal distinta a la del turno asignado
      Dado que "Marco Tello" tiene el turno "Mostrador AM" asignado a "Sucursal Roma"
      Cuando registra su entrada confirmando "Sucursal Condesa"
      Entonces el registro se guarda como pendiente de validación
      Y se agrega a la cola del coach con el motivo "sucursal cruzada"


  Regla: Sin señal GPS existe una vía de respaldo, pero siempre queda marcada para revisión

    Escenario: Colaborador sin GPS disponible usa código de respaldo
      Dado que "Iván Robles" no tiene señal de GPS disponible
      Cuando solicita el código de respaldo a su coach
      Y ingresa el código correcto
      Entonces su entrada se registra
      Y el registro queda marcado como "pendiente de pase" en la cola del coach con el motivo "sin GPS"

    Escenario: Código de respaldo incorrecto
      Dado que "Iván Robles" está en la pantalla de código de respaldo
      Cuando ingresa un código incorrecto
      Entonces el sistema no registra la entrada
      Y le permite reintentar


  Regla: La biometría facial es obligatoria para sellar cada entrada y salida

    Escenario: Verificación biométrica exitosa genera comprobante
      Dado que "Renata Solís" está dentro de la geocerca de "Sucursal Roma"
      Cuando toca "Verificar rostro y registrar"
      Y el sistema compara su rostro contra la biometría enrolada
      Y la coincidencia es de 98.6%
      Entonces se genera un comprobante con hora, coordenadas GPS, sucursal y porcentaje de coincidencia
      Y el colaborador debe confirmar "Sellar registro" para completar la entrada
      Y el comprobante queda disponible tanto para el colaborador como para el patrón, sin poder editarse después

    Escenario: Coincidencia biométrica insuficiente
      Dado que "Diego Mendoza" está dentro de la geocerca de "Bodega Narvarte"
      Cuando toca "Verificar rostro y registrar"
      Y la coincidencia facial es menor al 80%
      Entonces el sistema le permite reintentar la verificación hasta 3 veces
      Y si los 3 intentos fallan, el registro se guarda como "pendiente de pase"
      Y se agrega a la cola del coach con el motivo "biometría" y el porcentaje obtenido

      # Nota de producto: se eligió no bloquear por completo el check-in ante un fallo
      # biométrico, para no dejar a un colaborador sin forma de registrar su turno por
      # condiciones de luz o cámara. El caso queda evidenciado y sujeto a revisión del
      # coach, en vez de impedir el acceso. Pendiente de confirmar con negocio si algún
      # rol o sucursal requiere bloqueo estricto en vez de este flujo con pase.

    Escenario: Colaborador sin biometría enrolada no puede completar el check-in
      Dado que "Iván Robles" no tiene biometría facial enrolada
      Cuando llega dentro de la geocerca de su sucursal
      Entonces el sistema le impide sellar el registro
      Y le indica que debe completar su enrolamiento biométrico con su coach o administrador


  Regla: Los turnos respetan los límites de jornada de la Ley Federal del Trabajo

    Esquema del escenario: Un turno no puede exceder el máximo de horas de su jornada
      Dado que un administrador crea un turno de tipo "<jornada>"
      Cuando define un horario de <horas> horas de duración
      Entonces el sistema <resultado>

      Ejemplos:
        | jornada  | horas | resultado                                      |
        | diurna   | 8     | permite guardar el turno                       |
        | diurna   | 9     | bloquea el guardado y muestra el límite legal  |
        | nocturna | 7     | permite guardar el turno                       |
        | nocturna | 8     | bloquea el guardado y muestra el límite legal  |
        | mixta    | 7.5   | permite guardar el turno                       |
        | mixta    | 8     | bloquea el guardado y muestra el límite legal  |


  Regla: Un colaborador se da de alta con rol, sucursal(es) y biometría antes de poder operar

    Escenario: Alta completa de un colaborador nuevo
      Dado que un administrador inicia el alta de un colaborador
      Cuando captura nombre, teléfono y CURP/INE
      Y selecciona el rol "empleado"
      Y asigna la sucursal "Sucursal Roma"
      Y completa el enrolamiento biométrico facial
      Entonces el colaborador queda disponible para operar en el sistema
      Y aparece en el listado de "Colaboradores" con su rol y estatus de biometría

    Escenario: No se puede guardar un colaborador sin enrolamiento biométrico
      Dado que un administrador completó los datos, rol y sucursal de un colaborador nuevo
      Cuando intenta guardar sin completar el enrolamiento biométrico
      Entonces el botón "Guardar colaborador" permanece deshabilitado

    Escenario: Un colaborador con más de una sucursal recibe la advertencia de confirmación
      Dado que un administrador asigna dos sucursales a un colaborador
      Entonces el sistema le advierte que el colaborador deberá confirmar su sucursal cuando las geocercas se traslapen

    Esquema del escenario: El rol asignado determina los accesos del colaborador
      Dado que un administrador da de alta a un colaborador con rol "<rol>"
      Entonces el colaborador puede <acceso>

      Ejemplos:
        | rol      | acceso                                                              |
        | empleado | registrar su propia entrada, comida y salida con GPS y biometría    |
        | coach    | además, dar o negar el pase a los casos especiales de su sucursal   |
        | admin    | además, configurar sucursales, turnos y el alta de otros colaboradores |


  Regla: La cola de validación del coach concentra todos los casos especiales

    Esquema del escenario: Un caso especial aparece en la cola del coach con su motivo
      Dado que ocurre un evento de tipo "<evento>"
      Entonces se agrega un elemento a la cola de validación con el motivo "<motivo>"

      Ejemplos:
        | evento                                  | motivo           |
        | check-in fuera de cualquier geocerca     | geocerca         |
        | retardo mayor a la tolerancia del turno  | retardo          |
        | registro con código de respaldo          | sin GPS          |
        | check-in en sucursal distinta al turno   | sucursal cruzada |
        | turno sin salida marcada                 | auto-cierre      |
        | coincidencia biométrica insuficiente     | biometría        |

    Escenario: El coach da el pase a un caso especial
      Dado que existe un elemento pendiente en la cola del coach
      Cuando el coach toca "Dar pase"
      Entonces el registro de asistencia queda validado
      Y desaparece de la cola de pendientes

    Escenario: El coach rechaza un caso especial
      Dado que existe un elemento pendiente en la cola del coach
      Cuando el coach toca "Rechazar"
      Entonces el registro de asistencia queda marcado como no válido
      Y desaparece de la cola de pendientes

    Escenario: Un empleado no puede validar sus propios casos especiales
      Dado que "Renata Solís" tiene rol "empleado"
      Y tiene un caso especial pendiente en la cola de validación
      Cuando intenta acceder a la pantalla de "Validación"
      Entonces el sistema le niega el acceso por no tener rol de coach o administrador


  Regla: Cierre automático de turno cuando no se marca la salida

    Escenario: El sistema cierra el turno automáticamente
      Dado que "Ana Ferreiro" registró su entrada a las 14:30
      Y no marcó su salida antes de las 22:30, hora de cierre de su turno
      Cuando transcurre la hora de cierre
      Entonces el sistema cierra el turno automáticamente
      Y agrega el caso a la cola del coach con el motivo "auto-cierre"


  Regla: Ley Silla — Art. 132, 133, 422 y 423 LFT (DOF 19 dic 2024; disposiciones de la STPS del 17 jul 2025; las fuentes difieren en la fecha de exigibilidad, pero ya es exigible)

    # AVISO: la norma NO fija número de asientos por trabajador, características de las sillas
    # ni tiempos de descanso. Las cifras de estos escenarios son DEFAULTS DE PRODUCTO
    # configurables por tenant, no requisitos legales. Tampoco se codifica un puntaje de riesgo
    # hasta cotejar el texto oficial del DOF (las fuentes se contradicen).

    Antecedentes:
      Dado que "Sucursal Roma" tiene puestos de trabajo en bipedestación (de pie)

    Escenario: Registrar el diagnóstico de bipedestación de una sucursal
      Dado que un administrador edita "Sucursal Roma"
      Cuando indica cuántos puestos operan de pie
      Y captura el número de asientos con respaldo disponibles en el área o cerca de ella
      Entonces la sucursal queda marcada como "Diagnóstico de bipedestación: registrado"
      Y ese diagnóstico queda disponible como respaldo documental ante una inspección de la STPS

    # Heurística configurable (no es criterio legal de cumplimiento)
    Escenario: Alerta heurística cuando hay menos asientos que puestos de pie
      Dado que "Bodega Narvarte" tiene 4 puestos en bipedestación
      Y solo tiene 1 asiento con respaldo registrado
      Cuando el administrador guarda el diagnóstico
      Entonces el sistema muestra una alerta informativa de que los asientos podrían no ser suficientes
      Y sugiere revisarlo con la Comisión de Seguridad e Higiene antes de una inspección

    # Los umbrales de 4 h y 2 h son defaults de producto configurables, no cifras legales.
    Escenario: Recordatorio de descanso postural durante un turno largo
      Dado que "Jorge Aparicio" tiene un turno de bipedestación mayor a 4 horas continuas
      Y no ha registrado una pausa desde el inicio de su turno
      Cuando transcurren 2 horas sin pausa registrada
      Entonces la app le sugiere tomar un descanso postural
      Y el sistema deja evidencia de que la sugerencia fue mostrada

      # Nota de producto: esta pausa es una sugerencia informativa, no un bloqueo del
      # check-in ni del turno — la Ley Silla protege el derecho a sentarse, no impone
      # una pausa obligatoria con temporizador. El registro de que se mostró la
      # sugerencia es lo que sirve como evidencia de cumplimiento.

    Escenario: Un colaborador reporta incumplimiento de Ley Silla
      Dado que "Jorge Aparicio" considera que no tiene acceso a un asiento cuando lo necesita
      Cuando presenta un reporte desde la app
      Entonces el reporte llega a la cola del administrador, no a la del coach de turno
      Y queda registrado con fecha, sucursal y puesto, independiente de si se resuelve dentro de la app


  Regla: Reducción gradual de la jornada máxima semanal a 40 horas (reforma constitucional Art. 123, escalonada a 2030)

    Antecedentes:
      Dado que el tope legal de horas semanales se reduce de forma escalonada:
        | año  | tope semanal |
        | 2026 | 48 horas     |
        | 2027 | 46 horas     |
        | 2028 | 44 horas     |
        | 2029 | 42 horas     |
        | 2030 | 40 horas     |
      Y la reforma no permite reducir salario ni prestaciones por la disminución de horas

    Escenario: El sistema usa el tope vigente según la fecha actual
      Dado que la fecha del sistema está dentro del año 2027
      Cuando un administrador crea o edita un turno
      Entonces el sistema usa 46 horas como tope semanal de referencia
      Y lo muestra junto al selector de jornada del turno

    Esquema del escenario: Suma de turnos de un colaborador que se acerca o excede el tope semanal vigente
      Dado que "<colaborador>" tiene <horas_acumuladas> horas programadas esta semana
      Y el tope semanal vigente es <tope> horas
      Cuando el sistema calcula su acumulado semanal
      Entonces el estado mostrado es "<estado>"

      Ejemplos:
        | colaborador     | horas_acumuladas | tope | estado                                |
        | Renata Solís     | 40                | 46   | dentro del tope                       |
        | Lucía Beltrán    | 44                | 46   | cerca del tope — advertencia          |
        | Marco Tello      | 48                | 46   | excede el tope — requiere horas extra |

    Escenario: Un turno nuevo empujaría a un colaborador sobre el tope semanal
      Dado que "Marco Tello" ya tiene 44 horas programadas esta semana
      Y el tope semanal vigente es 46 horas
      Cuando un administrador intenta asignarle un turno adicional de 6 horas
      Entonces el sistema advierte que la suma excede el tope semanal vigente
      Y le pide confirmar explícitamente que las horas excedentes se pagarán como tiempo extra
      Y esa confirmación queda registrada junto con el turno

      # Nota de producto: no se bloquea la asignación —el patrón puede necesitar
      # cubrir el turno— pero la confirmación explícita evita que el registro
      # electrónico, que hace prueba plena, se vuelva evidencia de una jornada
      # excedida sin el pago correspondiente.

    Escenario: Reporte semanal de horas por colaborador para nómina
      Dado que termina la semana operativa
      Cuando un administrador abre el reporte de horas
      Entonces ve, por colaborador, las horas trabajadas, el tope vigente y las horas excedentes marcadas como tiempo extra
      Y puede exportar ese reporte para el proceso de nómina y como evidencia ante la STPS


  Regla: Cálculo de horas extra — Art. 66, 67 y 68 LFT (reforma DOF 1 mayo 2026, Transitorio Cuarto)

    Antecedentes:
      Dado que el tope de horas extra pagadas al doble antes de pasar a triple sube de forma gradual:
        | año  | tope horas extra al doble |
        | 2026 | 9 horas                   |
        | 2027 | 9 horas                   |
        | 2028 | 10 horas                  |
        | 2029 | 11 horas                  |
        | 2030 | 12 horas                  |
      Y las horas extra dentro del tope se pagan con 100% adicional sobre el salario por hora (al doble)
      Y las horas extra que exceden el tope se pagan con 200% adicional sobre el salario por hora (al triple)
      Y en ningún caso la jornada diaria (ordinaria + extraordinaria) puede superar 12 horas

    Esquema del escenario: El sistema separa horas ordinarias, dobles y triples de la semana
      Dado que "<colaborador>" trabajó <horas_semana> horas esta semana
      Y el tope semanal ordinario vigente es <tope_ordinario> horas
      Y el tope de horas extra al doble vigente es <tope_extra> horas
      Cuando el sistema calcula su nómina de la semana
      Entonces las horas ordinarias son <horas_ordinarias>
      Y las horas dobles son <horas_dobles>
      Y las horas triples son <horas_triples>

      Ejemplos:
        | colaborador    | horas_semana | tope_ordinario | tope_extra | horas_ordinarias | horas_dobles | horas_triples |
        | Renata Solís    | 40           | 48              | 9          | 40                | 0            | 0             |
        | Lucía Beltrán   | 53           | 48              | 9          | 48                | 5            | 0             |
        | Marco Tello     | 60           | 48              | 9          | 48                | 9            | 3             |

    Escenario: Cálculo del pago total con horas dobles y triples
      Dado que "Marco Tello" tiene un salario de $75.00 por hora y $600.00 de salario diario
      Y esta semana tiene 48 horas ordinarias, 9 horas dobles y 3 horas triples
      Cuando el sistema calcula su nómina
      Entonces el pago ordinario es 48 × $75.00 = $3,600.00
      Y el pago de horas dobles es 9 × $75.00 × 2 = $1,350.00
      Y el pago de horas triples es 3 × $75.00 × 3 = $675.00
      Y el sistema muestra una advertencia porque se superó el tope de horas extra permitido

    Escenario: Un colaborador que trabajó su domingo recibe la prima dominical
      Dado que "Lucía Beltrán" trabajó el domingo, su día de descanso habitual
      Y su salario diario es de $720.00
      Cuando el sistema calcula su nómina de la semana
      Entonces se agrega una prima dominical de 720.00 × 25% = $180.00
      Y este modificador es independiente del cálculo de horas extra

    Escenario: Un colaborador que trabajó su día de descanso sin sustituto recibe pago doble por ese día
      Dado que "Marco Tello" trabajó su día de descanso semanal
      Y no se le asignó un día de descanso sustituto
      Y su salario diario es de $600.00
      Cuando el sistema calcula su nómina de la semana
      Entonces se agrega un pago adicional de 600.00 × 2 = $1,200.00 por el descanso trabajado
      Y este modificador se suma junto con las horas dobles o triples que correspondan, si las hay

    Escenario: El resumen de nómina se puede exportar por semana
      Dado que un administrador está en la pantalla de "Nómina"
      Cuando toca "Exportar nómina de la semana"
      Entonces se genera un reporte con el desglose por colaborador: horas ordinarias, dobles, triples,
        prima dominical, descanso trabajado y total a pagar
      Y ese reporte puede usarse para timbrar el CFDI de nómina y como evidencia ante una inspección de la STPS

      # Nota de producto: el cálculo de tiempo extra no bloquea ni impide que el colaborador
      # trabaje más horas de las del tope — el patrón puede necesitarlo operativamente. Lo que
      # hace el sistema es calcular correctamente el pago que corresponde y dejarlo visible
      # antes de que se vuelva una discusión, en línea con la misma lógica de "registro que
      # protege a ambas partes" del resto del sistema.
```
