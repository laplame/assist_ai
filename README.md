# BizneAI

Kiosko de asistencia para una sucursal y tablero de tiempo extra. El teléfono registra la checada aunque no haya red. El servidor la acepta solo si la cadena de hashes no tiene huecos. El tablero web no sustituye al kiosko: simula nómina, pacta el salario y guarda la raíz del día.

Esto no es asesoría legal. Las cifras marcadas como fuente hay que confirmarlas con un contador antes de pagar.

## Piezas

| Pieza | Carpeta | Qué hace |
| --- | --- | --- |
| Kiosko | `apps/mobile` | Expo SDK 58. Da de alta la sucursal en el teléfono, pide PIN, toma foto y guarda la checada en SQLite aunque no haya red. |
| Tablero | `apps/web` | Vite. Teléfono y código, simulador, salario pactado, listado de colaboradores, código de kiosko y raíz Merkle. |
| API | `apps/api` | Node, Express y Mongoose. Cada consulta de negocio lleva el `tenantId` del token. |
| Integridad | `packages/integridad` | SHA-256, cadena y Merkle. El mismo código corre en el teléfono y en el servidor. |
| Cálculo | `packages/calculo` | Horas extra, exención y dos escenarios de SBC. Sin tabla de ISR no inventa un impuesto. |

El dominio no importa `expo-*` ni `react-native`. Esas dependencias viven en `apps/mobile/src/infrastructure` y en las pantallas.

## Arranque

```bash
npm --prefix packages/integridad run build
npm --prefix packages/calculo run build
npm --prefix apps/api install
npm --prefix apps/web install
npm --prefix apps/mobile install

npm run dev:api
npm run dev:web
```

La API escucha en `http://localhost:4000` y la web en `http://localhost:5173`.

`apps/api/.env`:

- `MONGODB_URI` de Atlas, con el nombre de la base.
- `JWT_SECRET` de al menos 16 caracteres.
- `SUPERADMIN_KEY` solo si vas a dar de alta otro negocio.
- Firebase queda opcional y solo cubre las rutas viejas de respaldo en `/api`.

La web usa `VITE_API_URL` si la API no está en `http://localhost:4000`.

El acceso de desarrollo compara el código guardado en el usuario. En producción ese puerto se cambia por un OTP. No está Twilio.

### Datos de demostración

Se crean una sola vez, si no existe `tenant-roma`.

| Quién | Teléfono | Código | PIN |
| --- | --- | --- | --- |
| Admin Roma | 5512345678 | 246810 | 9753 |
| Ana López | 5587654321 | 135790 | 2580 |

Sucursal Roma, Cuauhtémoc, Ciudad de México. Código de empareje `ROMADMO1`, vigente 30 días en la semilla. El radio de 15 km es de demostración, no una cifra legal. El catálogo de municipios trae solo Cuauhtémoc (general) y Tijuana (zona libre de la frontera norte). Otro municipio responde `ZONA_NO_CATALOGADA`. No se inventó el resto de la lista.

Membresía de Ana en el formulario de salario: `mem-ana`.

## Kiosko

El primer arranque, si el teléfono no tiene sesión, abre la bienvenida: tres pantallas, el alta de la sucursal (nombre, estado y municipio) y el PIN de quien administra el equipo. Ese PIN es el de checar. El panel de admin abre con `1234` hasta que se cambia por otro de 4 a 6 dígitos.

Al terminar el alta se puede enviar el equipo al servidor con la URL y el código `1234` (`POST /api/v1/kiosko/sincronizar`). Si no hay servidor, **Seguir en este teléfono** deja el modo local: las checadas se quedan en SQLite y el reloj dice **Sin conexión**. Cuando hay pendientes, el mismo indicador cuenta cuántas siguen en el teléfono.

En el reloj:

- **Checar** pide PIN y foto. Si la cámara no está o falla, la checada se guarda sin foto.
- **Inicio de pausa** y **Fin de pausa** piden PIN y no toman foto. Quedan como `pausa_inicio` y `pausa_fin` en la misma cadena de hash. Sirven de constancia de que la persona se sentó. Este equipo no mide el tiempo de pie ni califica la silla.
- **Mis checadas** muestra 14 días, solo hora y tipo.
- **Admin** da de alta colaboradores, arma el reporte del día para compartirlo, calcula horas y sueldo de la semana, da de alta sucursales, sincroniza y desvincula.

Desde el reloj en modo local sigue el formulario **Vincular sucursal**, con el código de 8 caracteres, y **Continuar sin servidor**. Esa segunda opción carga la Sucursal Roma de demostración: admin `9753`, Ana López `2580`.

No se usa `expo-audio`: el comprobante es visual, para no sumar un módulo nativo en teléfonos viejos. El estado vive en SQLite y en el estado de cada pantalla, sin Zustand. El APK lleva copias compiladas de `@bizne/integridad` y `@bizne/calculo` en `apps/mobile/vendor`, las mismas que pasan los vectores de cada paquete.

La sincronización corre al terminar la bienvenida, al vincular y desde Admin. No hay tarea en segundo plano: la API de `expo-background-task` no se añadió hasta confirmar el nombre del task en este SDK. Con la app abierta, Admin envía hasta 20 checadas y baja el catálogo. Sin red, el envío espera y la checada no se borra.

`minSdkVersion` se deja en el valor de Expo SDK 58, que es 24 (Android 7). No se baja. La evidencia está en `expo-modules-core`: `safeExtGet("minSdkVersion", 24)`. El APK no incluye iOS, OTA, device-owner ni comparación de huella por USB. La huella del sistema, si se llegara a pedir, solo confirma presencia: la app no guarda la plantilla.

El plugin `expo-build-properties` deja `usesCleartextTraffic` en false. El APK solo habla con una API en HTTPS. `EXPO_PUBLIC_API_URL` se define al construir.

### Instalar el APK

1. El APK de EAS se descarga del build. El APK local lo deja `scripts/move-apk.sh` en la raíz, con el nombre `bizneai-kiosko-AAAAMMDD-HHMMSS.apk`. Los `*.apk` no entran al repositorio. Ábrelo en el teléfono. Si Android avisa que el origen es desconocido, permite la instalación para esa app de archivos.
2. Ancla la pantalla: Ajustes, Seguridad, Anclaje de pantalla, o el recuadro de apps recientes y el icono de anclar. Así el kiosko no sale con el botón de inicio.
3. Saca el equipo de la optimización de batería: Ajustes, Batería, la app BizneAI Kiosko, Sin restricciones. Si no, Android duerme el proceso y deja de checar.
4. El teléfono va a estar conectado todo el día. Revisa de vez en cuando que la batería no esté hinchada. Si lo está, deja de usarlo y cámbialo.

## Integridad

La hoja Merkle es `SHA256(0x00 ‖ JSON canónico)`. Un nodo es `SHA256(0x01 ‖ izquierda ‖ derecha)` con los bytes crudos de cada hash. Si el nivel es impar, el último se junta con `NODO_VACIO = SHA256(0x02)`, no con una copia de sí mismo.

La cadena es `SHA256(utf8(hashPrevio + JSON canónico del cuerpo))`. La primera checada usa secuencia 1 y `GENESIS`. Un hueco o un hash que no continúa se rechaza. El PIN es `SHA256(utf8(sal + ":" + pin))`.

Anclar un día guarda la raíz con `anclaje: LOCAL` y una fila de auditoría. El correo y OpenTimestamps quedan como puerto, no como un envío que no ocurrió.

## Qué calcula el tablero

Horas ordinarias semanales usadas como fuente a verificar: 2026 = 48, 2027 = 46, 2028 = 44, 2029 = 42, 2030 = 40. El simulador lo dice en un aviso. El tope de exención semanal usado es la UMA de referencia del paquete, $586.55. Sin tabla de ISR la respuesta es `PARAMETRO_FALTANTE`.

El escenario IMSS conservador integra al SBC lo que rebase las horas dobles. El alterno solo integra si se rebasan los límites. El tablero muestra los dos y la diferencia.

## Qué no está

- Instagram y el flyer.
- Circuitos de conocimiento cero. La fase 2 solo se menciona.
- Twilio, reconocimiento facial, bloqueo de device-owner, huella por USB, OTA e iOS.
- La lista completa de municipios de la frontera norte y las tablas de ISR.
- Sello externo de la raíz.
- Cierre de prenómina, turnos del teléfono personal y la cola de validación del coach.
