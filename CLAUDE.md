# mi-cita-app — Guía del proyecto

Dashboard web (Angular 22) de **Mi Cita**. Consume la API REST del backend (Spring, `ProblemDetail` RFC 9457) bajo el prefijo `/api`.
Las tareas (HU) viven en Notion: _Go Action / Proyectos y tareas / Tareas_ (por ejemplo, "E01 · HU-01 · Front — Registro de usuario").

## Stack y comandos

- Angular 22 standalone + **zoneless**, signals, Reactive Forms tipados, SCSS propio (sin librería de UI), Vitest, ESLint (angular-eslint) y Prettier.
- `npm start`: servidor de desarrollo (usa `environment.development.ts` → `http://localhost:8080/api`).
- `npm run build`, `npm test` (watch), `npm run test:ci`, `npm run lint`, `npm run format` y `npm run format:check`.
- Antes de dar algo por terminado: `npm run lint`, `npm run test:ci` y `npm run build` en verde.

## Idioma

- **Código en inglés**: archivos, clases, variables y rutas internas.
- **UI en español**: textos visibles, mensajes de error al usuario y títulos de ruta.
- Los comentarios se escriben en inglés y son breves. Solo explican el _por qué_.

## Estructura (feature-first)

```
src/
├─ app/
│  ├─ core/            # singletons globales: config (tokens), http (interceptors, ApiError), error-handling, auth (sesión/guards)
│  ├─ shared/          # reutilizable y sin estado de negocio: ui/, forms/ (validators, helpers), pipes/, directives/, models/
│  ├─ layouts/         # shells con <router-outlet />: public-layout, admin-layout…
│  ├─ features/<dominio>/
│  │  ├─ pages/        # componentes de ruta (smart): <name>-page/
│  │  ├─ components/   # presentacionales del feature
│  │  ├─ data-access/  # <name>-api.ts (HTTP) y <name>-store.ts (estado con signals)
│  │  ├─ models/       # *.model.ts, *.dto.ts, *.mapper.ts
│  │  └─ <dominio>.routes.ts
│  ├─ app.config.ts  app.routes.ts  app.ts
├─ environments/       # environment.ts (prod) y environment.development.ts
└─ styles/             # arquitectura de estilos (ver más abajo)
```

### Reglas de dependencia (ESLint aplica parte de ellas)

- `features` → puede importar `shared`, `core` y `@env`.
- `layouts` → puede importar `shared` y `core`.
- `core` → puede importar `shared`, pero **no** `features` ni `layouts`.
- `shared` → no importa nada de `core`, `features` ni `layouts`.
- **Un feature nunca importa otro feature.** Lo que se comparta se mueve a `shared` (si es UI o utilidades) o a `core` (si es un singleton o la sesión).
- Imports con alias: `@core/*`, `@shared/*`, `@features/*`, `@layouts/*` y `@env/*`. Los relativos solo se usan dentro de la misma carpeta (`./`) o un nivel arriba (`../`). Dentro de un feature, si hay que subir más (por ejemplo, de `pages/x/` a `data-access/`), se usa `@features/<dominio>/...`.
- Cada feature se carga en diferido: `loadChildren: () => import('@features/x/x.routes')`. Las páginas usan `loadComponent` con `export default`.

## Nombres de archivos

Kebab-case y sin sufijo `.component`, según la guía de estilo actual de Angular. Un concepto por archivo; las pruebas (`.spec.ts`) van al lado del archivo que prueban.

| Tipo | Archivo | Símbolo |
| --- | --- | --- |
| Página (ruta) | `pages/register-page/register-page.ts` + `.html` y `.scss` | `export default class RegisterPage` |
| Componente | `components/user-card/user-card.ts` | `UserCard` |
| UI compartida | `shared/ui/form-field/form-field.ts` | `FormField` |
| Layout | `layouts/public-layout/public-layout.ts` | `PublicLayout` |
| Servicio HTTP | `data-access/auth-api.ts` | `AuthApi` |
| Store | `data-access/register-store.ts` | `RegisterStore` |
| Modelo de dominio | `models/user.model.ts` | `User`, `NewUser` |
| DTO | `models/register-user.dto.ts` | `RegisterUserRequestDto` |
| Mapper | `models/user.mapper.ts` | `toUser()`, `toRegisterUserRequestDto()` |
| Validador | `shared/forms/validators/password-strength.validator.ts` | `passwordStrength()` |
| Guard / Interceptor | `core/auth/auth-guard.ts`, `core/http/error-interceptor.ts` | `authGuard`, `errorInterceptor` |
| Rutas | `features/auth/auth.routes.ts` | `export default [...] satisfies Routes` |
| Token DI | `core/config/api-url.ts` | `API_URL` |

## Componentes

- Standalone (no se escribe `standalone: true`), con `changeDetection: ChangeDetectionStrategy.OnPush` siempre. ESLint lo exige.
- Usar `input()`, `input.required()`, `output()`, `model()`, `viewChild()` e `inject()`. No usar `@Input`/`@Output`, constructores con DI ni NgModules.
- Control flow `@if`/`@for` (con `track`)/`@switch` y `@let`. No usar `*ngIf`/`*ngFor`. Etiquetas autocerradas (`<app-x />`).
- **Pages (smart):** inyectan stores y APIs, leen parámetros de ruta como `input()` (está activo `withComponentInputBinding`) y orquestan.
- **Components/UI (presentacionales):** solo `input`/`output`, sin servicios de datos. Son fáciles de probar y de reutilizar.
- Template y estilos en archivos separados, salvo que el template tenga 3 líneas o menos. Nada de lógica en el template: los valores derivados se calculan con `computed()`.
- Accesibilidad: `label` asociado a cada input, `aria-invalid` y `aria-describedby` en los errores, y botones con texto o `aria-label`. Las reglas `templateAccessibility` de ESLint están activas.

## Servicios y estado

- `*-api.ts`: solo HTTP. Usa `inject(HttpClient)` e `inject(API_URL)`, mapea DTO ↔ modelo con los mappers y devuelve modelos de dominio. `providedIn: 'root'`.
- `*-store.ts`: estado con `signal()` privado, que se expone con `asReadonly()` y `computed()`. Los métodos de comando (`submit()`, `load()`) son los únicos que modifican el estado. Si el estado es de una sola página, el store se provee en `providers` de esa página.
- Para lecturas declarativas, usar `httpResource()`/`resource()`. Las mutaciones van por `HttpClient` dentro del store.
- Estados típicos de un store: `pending`, `error` (de tipo `ApiError | null`) y `data`. El botón de enviar se deshabilita con `pending()`.
- No se instalan librerías de estado (NgRx, etc.) sin acordarlo antes.

## Modelos, DTOs y errores

- **DTO** (`*.dto.ts`): refleja el contrato exacto del backend. Solo `interface` con `readonly`. Nunca se usa en templates ni en stores.
- **Modelo** (`*.model.ts`): es lo que usa la UI. Los mappers puros convierten entre DTO y modelo, y siempre tienen pruebas.
- `interface` para formas de objeto y `type` para uniones y utilidades. **No usar `enum`**: se usa un objeto `as const` y su tipo derivado (`(typeof X)[keyof typeof X]`).
- `any` está prohibido; se usa `unknown` con narrowing. El modo estricto de TypeScript está activo.
- **Errores HTTP:** `errorInterceptor` convierte todo `HttpErrorResponse` en `ApiError` (`@core/http/api-error.model.ts`) con `kind`, `status`, `message` y `fieldErrors`:
  - `kind`: `validation` (400), `conflict` (409), `unauthorized`, `forbidden`, `not-found`, `network`, `server` y `unknown`.
  - `fieldErrors` es el mapa `errors` del ProblemDetail (vacío si no viene). Se aplica al formulario con `applyServerErrors(form, fieldErrors)` de `@shared/forms/apply-server-errors`.
  - Los stores y páginas trabajan con `ApiError` y nunca con `HttpErrorResponse`.

## Formularios

- Reactive Forms tipados con `inject(NonNullableFormBuilder)`.
- Los validadores reutilizables van en `shared/forms/validators/`. Son funciones puras con pruebas y reproducen las reglas del backend. Ejemplo: `passwordStrength()` devuelve `{ passwordStrength: { failed: [...] } }`.
- Los mensajes de error en español se resuelven en el componente de campo (`shared/ui/form-field`), no repartidos por cada template.
- Al enviar con el formulario inválido: `markAllAsTouched()` y no se llama a la API.

## Estilos

```
src/styles/
├─ abstracts/   # SOLO Sass sin salida CSS: breakpoints, mixins (respond-to, focus-ring, visually-hidden) y functions (rem)
├─ tokens/      # paleta Sass ($blue-600…) + CSS custom properties: --space-*, --font-*, --radius-*, --shadow-*, --z-*
├─ themes/      # _light.scss: tokens semánticos --color-* (un futuro dark redefine las mismas variables)
├─ base/        # reset, tipografía base y foco/placeholder
├─ utilities/   # pocas clases con prefijo u- (u-stack, u-visually-hidden)
└─ styles.scss  # único punto de entrada global; solo @use
```

- En un componente, la primera línea es `@use 'abstracts' as *;`; `includePaths` ya apunta a `src/styles`.
- Siempre `@use`/`@forward`. Nunca `@import`.
- **Solo tokens**: colores `var(--color-*)`, espacios `var(--space-*)`, tipografía `var(--font-*)`, radios `var(--radius-*)`. No hay hex ni px sueltos en componentes (la excepción son los bordes de 1px). Si falta un token, se añade en `tokens/` o `themes/`.
- La paleta Sass (`tokens/_colors.scss`) solo se usa desde `themes/`. Los componentes usan los tokens semánticos.
- `:host` define el display del componente. Las clases siguen un BEM ligero (`.register-form`, `.register-form__actions`, `.register-form--compact`).
- Diseño mobile-first con `@include respond-to(md) { … }` (breakpoints `sm` 576, `md` 768, `lg` 1024, `xl` 1280).
- Prohibido usar `::ng-deep`, `!important` y `ViewEncapsulation.None`. Presupuesto: 4 kB por componente.

```scss
@use 'abstracts' as *;

:host { display: block; }

.login-card {
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);

  @include respond-to(md) { padding: var(--space-10); }

  &__title { color: var(--color-text); font-size: var(--font-size-xl); }
}
```

## Pruebas

- Vitest con `.spec.ts` junto al archivo que se prueba.
- **Obligatorias:** validadores, mappers, stores y utilidades de `core`/`shared`.
- **Componentes:** se prueba el comportamiento visible (lo que se renderiza, los outputs emitidos y si se llama o no a la API), no los detalles internos.
- Para HTTP se usa `provideHttpClient()` + `provideHttpClientTesting()` con `HttpTestingController`.

## Flujo de trabajo de una HU

0. Confirmar el tipo de trabajo y ubicarse en la rama de la HU desde `integration` (ver "Git y GitHub").
1. Leer la tarea en Notion: criterios de aceptación, notas técnicas, mockups y definición de terminado.
2. Revisar el contrato del backend en su tarea "Back" equivalente (ruta, DTO, códigos 400/409).
3. Implementar dentro de `features/<dominio>/` siguiendo estas reglas. La UI que se reutilice va a `shared/ui`.
4. Escribir las pruebas y pasar `lint`, `test:ci` y `build`.
5. Comprobar la DoD de la tarea punto por punto.

## Git y GitHub

- **Nunca hacer push, merge ni PR a `main` salvo que el usuario lo pida explícitamente nombrando `main`.** Flujo de ramas: `integration` → `staging` → `main`. Los PR de trabajo van a `integration`.
- **Trabajo sobre una HU de Notion:** primero se confirma el tipo de trabajo (nueva funcionalidad → `feat`, ajuste o corrección de bug → `fix`, actualización de una funcionalidad → `feat`/`refactor`). Luego, partiendo de `integration`, se trabaja y se hace push en una única rama por HU con su código: "E01 · HU-02" → `E01-HU-02`. Excepciones: `chore/<slug>` desde `integration` y `hotfix/<slug>` desde `main`, este último solo cuando haya un incidente en producción.
- Las tareas de repositorio (ramas, commits, push, PRs, hotfixes, rollbacks, conflictos e historial) las hace el agente `repo-manager` (`.claude/agents/repo-manager.md`). Ahí están las convenciones de ramas y commits (Conventional Commits en español, incluidos `hotfix` y `revert`), el protocolo de rollback y la ejecución rigurosa de pruebas obligatoria antes de commit, push y PR.
- Remoto: `GoAction-MiCita/MiCita-FrontEnd`.

## No hacer

NgModules · `any` · `enum` · `@Input`/`@Output` · `*ngIf`/`*ngFor` · `@import` en SCSS · `::ng-deep` · valores de color o espacio sueltos · imports entre features · `HttpErrorResponse` fuera de `core` · lógica de negocio en templates · librerías nuevas (UI o estado) sin acordarlo antes.
