# Arquitectura

## Baseline técnica

Aplicación TypeScript/React 19 con Next 16 como API y semántica de rutas, compilada mediante Vite/Vinext para Cloudflare Workers. La persistencia actual es Cloudflare D1 (SQLite) con Drizzle ORM.

```text
Navegador
  ├─ React client shell (app/page.tsx)
  ├─ Staff / Player según sesión autenticada
  └─ fetch /api/*
        ├─ autenticación y autorización
        ├─ validación y auditoría
        ├─ acceso D1 / Drizzle
        └─ dataset DEMO de respaldo/semilla
```

## Capas actuales

### UI

- `app/page.tsx`: shell, routing interno, estado de vista y la mayor parte de componentes Staff/Player.
- `app/globals.css`: design system y responsive.
- `app/layout.tsx`: metadatos, documento y fuentes.

La UI es funcional pero monolítica. La extracción de módulos debe hacerse por branches pequeñas y con tests de caracterización, no mediante una reescritura total.

### Datos cliente

- `app/data.ts`: semilla DEMO y calendario; su plantilla inicial no participa en el runtime autenticado.
- `app/phase2-data.ts`: partidos, sesiones ampliadas, molestias, disponibilidad y revisiones DEMO.
- La respuesta de `/api/data` hidrata la aplicación autenticada y es la única fuente de jugadores activos/archivados. Todos los selectores, contadores y métricas reciben esa plantilla explícitamente.
- Las escrituras persistentes pasan por `/api/state` y rutas administrativas específicas.

### API y servidor

- `app/api/auth/*`: player PIN, staff DEMO, sesión y logout.
- `app/api/data`, `app/api/state`: lectura/escritura de estado autorizado.
- `app/api/admin/*`: jugadores, staff y migración DEMO.
- `app/api/import`, `app/api/export`: intercambio de plantilla/datos.
- `lib/server/platform.ts`: autorización, cookies, hashing, rate limiting, D1, semilla, auditoría y reglas de acceso.

### Métricas

- `domain/metrics/`: hogar único de tipos, primitivas, formateo contractual y reglas de señales testeadas.
- `buildMetrics` sigue temporalmente en `app/page.tsx` hasta completar su extracción.
- `docs/METRICS.md` es el contrato canónico hasta completar la centralización.

### Persistencia

- `db/schema.ts`: 26 tablas Drizzle.
- `drizzle/0000_lying_terrax.sql`: migración actual.
- `db/index.ts`: acceso tipado.
- Binding esperado: `env.DB`.

## Flujo de autenticación

1. El usuario elige acceso Player o Staff en la pantalla pública.
2. Player consulta el directorio público limitado, selecciona nombre e introduce PIN.
3. Staff debe existir en `staff_permissions`; el acceso DEMO usa correo + código y la plataforma puede aportar identidad.
4. El servidor crea una sesión revocable en `auth_sessions` y cookie segura.
5. `/api/auth/me` resuelve rol y alcance.
6. Cada endpoint sensible repite autorización y aislamiento por `team_id`/`player_id`.

Ocultar UI no constituye autorización. Ver `SECURITY.md`.

## Flujo de escritura

```text
Interacción → validación cliente → API → sesión/rol/equipo → validación servidor
→ transacción D1 → audit_log si aplica → respuesta → actualización UI
```

Las ediciones de datos introducidos por un jugador deben conservar actor, valor anterior/nuevo y fecha en auditoría.

## Build y ejecución

- `vite.config.ts` integra React RSC, Vinext y Cloudflare.
- `worker/index.ts` es el punto de entrada del Worker.
- `scripts/build-verified.sh` envuelve el build y valida el artefacto.
- `.openai/hosting.json` enlaza la baseline con Sites; no es necesario para la lógica del producto, pero debe desacoplarse solo en una branch posterior verificada.

## Portabilidad prevista

La siguiente arquitectura objetivo conserva React/TypeScript y separa gradualmente:

```text
UI → hooks/services → API → dominio/métricas → repositorios → PostgreSQL
```

La migración D1→PostgreSQL y el proveedor de autenticación no forman parte de esta baseline. Deben abordarse después de pruebas de caracterización, manteniendo contratos de API y reglas de permiso.

## Restricciones conocidas

- `app/page.tsx`, `app/globals.css` y `app/data.ts` son muy grandes.
- Parte de las métricas y alertas está acoplada a la UI.
- El dataset DEMO vive en código.
- La cobertura de tests es mínima.
- Los assets UCAM se cargan desde URLs externas.

La priorización está en `TECH_DEBT.md` y `ROADMAP.md`.
