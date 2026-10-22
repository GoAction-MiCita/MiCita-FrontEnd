---
name: hu-workflow
description: Flujo automático de historias de usuario (HU) Front de mi-cita-app desde Notion. Revisa el tablero "Tareas" de Go Action, toma las tareas Front asignadas a LUIS CARLOS RUIZ CHICANGANA que pasan a "En curso", las implementa con sus pruebas unitarias y de seguridad, actualiza el mock, crea el PR hacia integration, mueve la tarea a "En revisión" y notifica. Úsala en cada revisión programada del tablero y siempre que el usuario escriba "ejecutar hu <título o código>" (a cualquier hora), "revisar el tablero", "trabajar la HU X" o "/hu-workflow", y para reprogramar las revisiones.
---

# Flujo automático de historias de usuario (Front)

Esta skill **no reemplaza** las reglas del proyecto: las aplica. Antes de cualquier paso relee y respeta:

- `CLAUDE.md`: arquitectura, convenciones de código, estilos, pruebas y "Backend simulado (Postman mock en un worktree)".
- `.claude/agents/repo-manager.md`: ramas por HU, commits, ejecución rigurosa de pruebas, `main` protegida, rollback y la rama de herramientas `chore/mock-server`. Toda operación de git y GitHub se delega a ese agente.

Responde siempre en español.

## 1. Alcance (qué tareas se trabajan)

| Dato | Valor |
| --- | --- |
| Tablero (único) | Notion › Go Action › Proyectos y tareas › Tareas |
| Data source | `collection://1f832ec0-b58b-82cd-8f0f-87fa645966ff` |
| Propiedad de estado | `Estado` (status): Sin empezar · En curso · En revisión · Listo para integrar · En espera · Completado · Archivado |
| Propiedad de responsable | `Luis carlos` (person) |
| Responsable válido | LUIS CARLOS RUIZ CHICANGANA → `user://38ad872b-594c-819e-8a85-000274896b16` |
| Capa | Solo títulos con `· Front —` (este repositorio es el frontend) |

- **Solo** se trabajan tareas de ese tablero, asignadas a ese usuario y de capa Front. Cualquier otra (otro responsable, otra capa u otro tablero) se ignora en silencio, aunque esté "En curso".
- Una tarea "Back" solo se **lee**, como fuente del contrato de la API.

## 2. Disparo

La skill se ejecuta de tres formas:

1. **Revisión programada**: un job de la sesión ejecuta el modo "revisar" a las 8:00, 11:00, 14:00, 17:00, 20:00 y 23:00 (ver §9).
2. **Ejecución manual de una HU**, en cualquier momento y sin esperar la hora de revisión: cuando el usuario escribe `ejecutar hu <título o código>`, por ejemplo `ejecutar hu E02 · HU-09 · Front — Registrar servicio`, `ejecutar hu HU-09` o `ejecutar hu Registrar servicio`. Ver §2.3.
3. **Otros comandos manuales**: `revisar el tablero` o `/hu-workflow revisar` (fuerza una revisión ahora) y `/hu-workflow programar` (ver §9).

### 2.1 Consulta del tablero

Usa `notion-query-data-sources` en modo `rows` con este filtro:

```json
{
  "mode": "rows",
  "data_source_url": "collection://1f832ec0-b58b-82cd-8f0f-87fa645966ff",
  "filter": { "type": "group", "operator": "and", "filters": [
    { "type": "property", "property": "Estado", "propertyType": "status", "operator": "status_is",
      "value": { "type": "is_option", "value": "En curso" } },
    { "type": "property", "property": "Luis carlos", "propertyType": "person", "operator": "person_contains",
      "value": { "type": "exact", "value": "user://38ad872b-594c-819e-8a85-000274896b16" } },
    { "type": "property", "property": "Nombre de la tarea", "propertyType": "title", "operator": "string_contains",
      "value": { "type": "exact", "value": "· Front —" } }
  ] },
  "limit": 50
}
```

### 2.2 Qué hacer con cada resultado

Lleva el estado local en `.claude/hu-workflow.state.json` (ignorado por git), con forma `{ "<código HU>": { "status": "...", "notionUrl": "...", "question": "...", "pr": "...", "updatedAt": "..." } }`. Los `status` posibles son `in-progress`, `waiting-answer`, `waiting-pr` y `done`.

| Situación | Acción |
| --- | --- |
| Sin tareas "En curso" | No hagas nada ni notifiques. Responde una línea: "Tablero revisado: sin tareas En curso". |
| Tarea nueva (no está en el estado local) | Iníciala (§3). |
| `waiting-answer` | No la retomes ni repitas la pregunta. Solo recuerda que sigue pendiente, como mucho una vez al día. |
| `in-progress` (sesión interrumpida) | Retómala desde su rama `E0X-HU-YY` y el estado del árbol. |
| `waiting-pr` | Comprueba si el PR ya existe (`gh pr list --head <rama>`). Si existe, completa §7. |
| Varias tareas nuevas | Trabaja **una a la vez**: Prioridad Alta > Media > Baja y luego la más antigua. Deja las demás en cola y menciónalas en el informe. |

Antes de iniciar, comprueba que el árbol de la carpeta principal esté limpio. Si hay cambios sin commit, no empieces: notifica y pregunta.

### 2.3 `ejecutar hu <título o código>` (disparo manual)

1. Busca la tarea en el mismo data source con `notion-query-data-sources` (modo `rows`): filtra `Nombre de la tarea` por `string_contains` con lo que escribió el usuario (el código `HU-YY`, `E0X · HU-YY` o parte del título) y por `· Front —`.
2. Según el resultado:
   - **Ninguna coincidencia**: dilo y no hagas nada.
   - **Varias coincidencias**: pregunta cuál, con `AskUserQuestion` y las opciones encontradas.
   - **Una coincidencia**: continúa.
3. Las reglas de alcance de §1 **se mantienen**. Si la tarea no está asignada a LUIS CARLOS RUIZ CHICANGANA o no es Front, no la trabajes: explícalo y detente.
4. **No exige** el estado "En curso" ni la hora de revisión: la instrucción explícita del usuario basta. No cambies el estado de la tarea al empezar (no la muevas a "En curso"). Si estaba en "Completado", "Archivado" o "Listo para integrar", confirma antes de empezar, porque podría ser un retrabajo.
5. Si otra HU está en `in-progress`, pregunta si se pausa la actual o si la nueva se pone en cola. Nunca trabajes dos a la vez.
6. A partir de aquí sigue el flujo normal desde §3, con las mismas reglas de bloqueo, pruebas, seguridad, entrega y notificación.

## 3. Lectura y análisis de la HU (siempre antes de tocar código)

1. Haz `fetch` de la tarea Front: criterios de aceptación, notas técnicas, dependencias, pruebas requeridas, DoD y diseño.
2. Descarga los mockups con `notion-get-file-download-urls` en el scratchpad y **míralos**.
3. Busca y lee la tarea Back equivalente (mismo `E0X · HU-YY`): ruta, DTO, códigos y supuestos. Lee también las HU de las que depende.
4. Revisa el código actual: qué existe ya (core/auth, shared/ui, features), qué se reutiliza y qué rompería.

### 3.1 Regla de bloqueo por ambigüedad (obligatoria)

Si aparece cualquiera de estos casos, **no ejecutes**: no crees la rama ni escribas código. Guarda el estado `waiting-answer`, notifica (§8) y pregunta con `AskUserQuestion`, con opciones concretas y una recomendada:

- Decisiones de **arquitectura**: un feature nuevo frente a uno existente, dónde vive el estado, cambios en core o en layouts, librerías nuevas, almacenamiento o seguridad.
- Comportamiento de UX **no especificado** o **contradictorio** entre la HU, el mockup y la tarea Back (por ejemplo, si un modal se puede cerrar o a dónde se navega tras una acción).
- Elementos del mockup que **no tienen backend** o que no están en los criterios: si se implementan, se dejan visuales o no se hacen.
- Notas de Notion marcadas con ⚠️, "sin dato" o ❓ que afecten a la implementación del front.
- Alcance que se solapa con otra HU, o una dependencia que todavía no está en `integration`.
- Tipo de trabajo dudoso (ver §4.1).

**Supuestos permitidos sin preguntar**, que siempre se documentan en el PR y en Notion:

- Nombres de campos del DTO cuando la tarea Back aún no los define: camelCase en inglés, aislados en `*.dto.ts` y `*.mapper.ts`, siguiendo el estilo de los DTO existentes.
- Textos de error y placeholders cuando el mockup no los muestra, en el tono de los ya existentes.

Cuando el usuario responda, continúa la misma tarea desde donde quedó.

## 4. Preparación

### 4.1 Tipo de trabajo (protocolo de repo-manager)

| Indicio en la HU | Tipo |
| --- | --- |
| Funcionalidad nueva (lo normal en una HU Front) | Nueva funcionalidad → `feat` |
| El título o la descripción hablan de ajuste, corrección, bug o error | Ajuste o corrección de bug → `fix` |
| Cambia una funcionalidad ya entregada | Actualización → `feat` o `refactor` |
| No está claro | Pregunta (§3.1) |

### 4.2 Rama

Delega en `repo-manager`. La rama es `E0X-HU-YY`, creada desde `origin/integration` actualizado, o la existente si ya está en origin, actualizada con `merge origin/integration`. Guarda el estado `in-progress`.

## 5. Implementación

- Sigue `CLAUDE.md` al pie de la letra: feature-first, signals, Reactive Forms tipados, `ApiError`, solo tokens SCSS, accesibilidad y alias de imports.
- **Pruebas unitarias de Angular (Vitest) por cada HU**, como en HU-01 a HU-03:
  - Obligatorias: validadores, mappers, `*-api.ts` (con `HttpTestingController`), stores y utilidades de core y shared.
  - Componentes y páginas: comportamiento visible (render, validaciones, que no llame a la API si el formulario es inválido, estados pending y error, cada código de respuesta de los criterios: 400, 401, 403, 409…).
  - Nunca se desactivan ni debilitan pruebas existentes. Si un cambio intencional rompe una, se explica en el informe.

### 5.1 Mock (regla del servidor mock)

En el worktree `../mi-cita-mock` (rama `chore/mock-server`, que **nunca** se integra):

1. Haz `git pull`, y si existe la rama local, un `merge origin/integration`.
2. Añade los endpoints de la HU a la colección (request, `pm.test` y ejemplos de cada código) y al escenario con estado `frontend.js`. Las rutas privadas validan el Bearer del mock.
3. Ejecuta `npm run mock:contract`. **Nunca** uses `postman mock generate --update`.
4. Levanta el mock en el 8080 y corre la colección con `--env-var "baseUrl=http://localhost:8080"`. Debe quedar en verde.
5. Delega en `repo-manager` el commit `chore(mock): …` y el push a `origin/chore/mock-server`. **Sin PR.**

## 6. Verificación

1. Ejecución rigurosa de pruebas del agente: detección de `.only`/`.skip`, `lint`, `format:check`, `test:ci` y `build`.
2. Verificación en el navegador integrado: `npm start` en la carpeta principal, con el mock en el 8080 desde el worktree. Recorre cada criterio de aceptación y las vistas de escritorio y móvil según los mockups.
3. Recorre la DoD de la tarea punto por punto y anota qué queda pendiente (normalmente "Integrado con el backend real").

### 6.1 Pruebas de seguridad (obligatorias en cada HU)

Se ejecutan **antes del commit**, sobre el estado final de la rama y después de `npm run build`. Buscan vulnerabilidades, fugas de datos, entradas sin validar y puertas traseras.

| # | Prueba | Comando o método | Bloquea si… |
| --- | --- | --- | --- |
| 1 | Escaneo estático del cambio y del bundle | `npm run security:scan` (`tools/security/security-scan.js`, base `origin/integration`) | Hay algún hallazgo **HIGH** (código de salida 1) |
| 2 | Dependencias de producción | `npm run security:audit` (`npm audit --omit=dev --audit-level=high`) | Hay vulnerabilidades high o critical en producción |
| 3 | Dependencias de desarrollo | `npm audit` | No bloquea: se reporta y se propone un `chore` de actualización |
| 4 | Revisión de seguridad del diff | La skill `security-review` sobre los cambios pendientes de la rama | Encuentra un problema explotable |
| 5 | Pruebas unitarias de seguridad de la HU | Vitest, junto al resto de pruebas | Falta alguna para el código de la HU |
| 6 | Verificación en el navegador | Navegador integrado con el mock (§6.2) | Ver la lista de §6.2 |

**Qué revisa `security:scan`** (solo las líneas añadidas en `src/` y los archivos nuevos):

- **XSS**: `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write` y `bypassSecurityTrust*`.
- **Código dinámico**: `eval`, `new Function` y `setTimeout` con string.
- **Secretos y credenciales**: API keys, tokens de GitHub o AWS, claves privadas y contraseñas en código de producción.
- **Almacenamiento de tokens**: `localStorage`/`sessionStorage` fuera de `core/auth/token-storage.ts`.
- **Puertas traseras**: `skipAuth`/`bypassAuth`/`debugMode`, datos del mock (`mock-signature`, `Abc#12`) en código de producción, y guards comentados en rutas.
- **Salidas**: `fetch`/`XMLHttpRequest`, que se saltan los interceptores, URLs absolutas fuera de `environments`, `window.location` (redirección abierta) y `target="_blank"` sin `rel="noopener noreferrer"`.
- **Fugas**: `console.*` en producción.
- **Dependencias nuevas** en `package.json`: requieren aprobación explícita.
- **Bundle de producción** (`dist/`): datos del mock, URLs a `localhost` y source maps.

**Pruebas unitarias de seguridad** que debe tener cada HU, según lo que toque:

- Rutas privadas nuevas protegidas por `authGuard`, con una prueba que redirige al login.
- Entradas con contenido malicioso (`<script>`, `<img onerror>`) que se muestran como texto y nunca se interpretan.
- Validadores que rechazan formatos inválidos y longitudes extremas.
- Redirecciones (`returnUrl` u otros parámetros) que solo aceptan rutas internas.
- Errores del servidor que no exponen detalles internos al usuario (como el 401 genérico del login).
- El token solo se envía a `API_URL` (lo cubre `auth-interceptor.spec.ts`; amplíalo si la HU añade otro host).

### 6.2 Verificación de seguridad en el navegador

Con la app y el mock en marcha, durante la prueba manual de §6 comprueba que:

- `localStorage`/`sessionStorage` solo contienen `micita.refreshToken`, nunca el access token ni datos personales.
- Todas las peticiones de red van a `API_URL`, sin hosts externos inesperados.
- La consola no muestra errores ni datos sensibles.
- Al pegar `<script>alert(1)</script>` o `"><img src=x onerror=alert(1)>` en los campos de la HU, se muestra como texto y nunca se ejecuta.
- Las rutas privadas de la HU redirigen al login sin sesión, y con un token alterado el backend simulado responde 401.

### 6.3 Política ante hallazgos

- **HIGH o critical**: corrígelo antes del commit. Si la corrección exige una decisión de arquitectura o de alcance, aplica §3.1: detente, notifica y pregunta.
- **MEDIUM**: corrígelo si está dentro del alcance de la HU; si no, documéntalo como pendiente en el PR.
- **LOW**: documéntalo.
- Un falso positivo **no se silencia** cambiando la regla dentro de la HU. Explícalo en el PR; si la regla debe ajustarse, se hace en un `chore` aparte.
- Todo hallazgo y su resolución van a la sección **Seguridad** del PR y de "Trabajo realizado" en Notion.

## 7. Entrega

1. Delega en `repo-manager`:
   - El commit `<tipo>(<ámbito>): … (E0X · HU-YY · Front)` y `git push -u origin E0X-HU-YY`.
   - El **PR hacia `integration`** con `gh pr create --base integration --head E0X-HU-YY`. El cuerpo lleva: resumen, enlace a la HU, checklist de criterios y DoD, pruebas con números, **seguridad** (resultado de cada prueba de §6.1 y hallazgos con su resolución), rollback y supuestos. Termina con `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
   - Si `gh` no está disponible o no está autenticado (`gh auth status`), entrega la URL de comparación y el texto del PR, guarda el estado `waiting-pr` y notifica. **No muevas la tarea** hasta que el PR exista.
2. Con el PR creado, actualiza Notion:
   - `notion-update-page` → `update_properties` → `{"Estado": "En revisión"}`.
   - Añade al final de la página una sección "Trabajo realizado" con la fecha, el enlace al PR, los cambios, las pruebas, la seguridad y los supuestos o pendientes, en el mismo formato que usan las tareas Back.
3. Guarda el estado `done` y notifica la finalización (§8).

## 8. Notificaciones

Usa `PushNotification` (una línea de menos de 200 caracteres, sin markdown) y repite el detalle en el chat:

| Evento | Mensaje |
| --- | --- |
| Pregunta bloqueante | `HU E0X-HU-YY en pausa: necesito una decisión sobre <tema>` |
| Tarea completada | `HU E0X-HU-YY completada: PR #N a integration, tarea en "En revisión"` |
| PR pendiente (sin gh) | `HU E0X-HU-YY lista: crea el PR con el enlace del chat` |
| Fallo que impide terminar | `HU E0X-HU-YY detenida: <causa en pocas palabras>` |
| Hallazgo de seguridad que necesita decisión | `HU E0X-HU-YY en pausa: hallazgo de seguridad <tipo> requiere tu decisión` |

No notifiques las revisiones sin novedades.

## 9. Programación de las revisiones

`/hu-workflow programar` (o cuando `CronList` no muestre el job):

- `CronCreate` con `cron: "0 8,11,14,17,20,23 * * *"`, `recurring: true` y `prompt: "/hu-workflow revisar"`.
- Antes de crear el job, revisa `CronList` para no duplicarlo.
- Límites que hay que recordar al usuario:
  - El job vive **solo en esta sesión** y solo se ejecuta con la app abierta y la sesión inactiva.
  - Puede retrasarse hasta unos 30 minutos.
  - **Caduca a los 7 días**: hay que volver a ejecutar `/hu-workflow programar`.

## 10. Autorizaciones que concede esta skill

Al estar dentro de este flujo, y solo para la tarea en curso, el usuario autoriza de antemano:

- El push de la rama `E0X-HU-YY` y la creación de su PR hacia `integration`.
- El commit y el push de `chore/mock-server` (sin PR).
- Cambiar `Estado` a "En revisión" y añadir "Trabajo realizado" en la tarea de Notion.

**Siguen prohibidos** sin una petición explícita del usuario: tocar `main` o `staging`, hacer push directo a `integration`, hacer merge de cualquier PR, cambiar otros estados o tareas de Notion, trabajar tareas ajenas y abrir PR de `chore/mock-server`.
