# UCAM Performance

UCAM Performance es una plataforma de sports performance para el trabajo diario de un cuerpo técnico de fútbol. Integra carga interna, RPE, bienestar, disponibilidad, sesiones, partidos, alertas explicables e informes en dos experiencias separadas: **Staff** y **Player**.

Esta revisión es la **WORK FINAL BASELINE**: el cierre de la etapa de prototipado y product discovery en ChatGPT Work y el punto de partida para ingeniería con GitHub, Cursor y Codex.

## Estado de la baseline

- Producto funcional con dataset DEMO de 20 jugadores y 38 jornadas.
- Interfaz UCAM responsive para Staff y Player.
- Persistencia relacional en Cloudflare D1 mediante Drizzle/SQL.
- Roles `PLAYER`, `STAFF` y `ADMIN` comprobados en backend.
- Login Player mediante nombre + PIN; Staff mediante correo autorizado y código DEMO o identidad de plataforma.
- Build, lint, typecheck y tests disponibles por script.
- Sin secretos versionados; `.env.example` contiene únicamente nombres y notas.
- La documentación canónica vive en [`docs/`](docs/README.md).

## Requisitos

- Node.js `>=22.13.0`.
- npm y el `package-lock.json` incluido.
- Para la ruta Cloudflare actual: Wrangler y un binding D1 llamado `DB`.
- Los scripts de instalación/build endurecidos usan Bash, `flock`, `curl` y GNU `timeout`. En macOS puede ejecutarse `npm ci`, `npm run dev` y `npm run typecheck`; el pipeline exacto de Sites está orientado a Linux.

## Instalación

```bash
npm ci
cp .env.example .env.local
npm run dev
```

La aplicación local se sirve mediante Vite/Vinext. El binding D1 de desarrollo se describe en `wrangler.jsonc` y `vite.config.ts`.

## Scripts principales

| Comando | Uso |
| --- | --- |
| `npm run dev` | Desarrollo local con Vite/Vinext. |
| `npm run build` | Build de producción y validación del artefacto actual. |
| `npm run start` | Ejecuta el build generado. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript estricto sin emitir archivos. |
| `npm run test:unit` | Tests unitarios actuales del motor de métricas. |
| `npm run test:render` | Build + prueba mínima de render del Worker. |
| `npm test` | Build + todos los tests actuales. |
| `npm run check` | Lint + types + build + tests. Es la puerta de calidad de la baseline. |
| `npm run db:generate` | Genera migraciones Drizzle tras cambios de esquema. |

## Arquitectura resumida

- `app/page.tsx`: shell cliente y experiencias Staff/Player. Es funcional, pero todavía monolítico.
- `app/api/`: autenticación, datos, persistencia, administración, importación y exportación.
- `app/data.ts`: dataset histórico DEMO procedente del Excel de referencia.
- `app/phase2-data.ts`: escenarios DEMO de disponibilidad, partidos, dolor y alertas.
- `domain/metrics/`: hogar único de tipos, primitivas, formateo, señales y `buildMetrics`.
- `lib/server/platform.ts`: autenticación, autorización, semilla DEMO, auditoría y D1.
- `db/schema.ts`: modelo relacional de 26 tablas.
- `drizzle/`: migración SQL versionada.
- `tests/`: cobertura mínima actual.
- `docs/`: documentación de producto, métricas, datos, UX, diseño, rutas y handoff.

El diagrama y el flujo detallado están en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Datos y privacidad

La aplicación desplegada conserva el dataset DEMO construido durante Work. Antes de subir el código a un repositorio compartido o público, usa el **paquete de handoff anonimizado** entregado junto a esta baseline o ejecuta el proceso descrito en [`docs/HANDOFF.md`](docs/HANDOFF.md). No subas exportaciones D1, ficheros `.env`, bases de datos locales ni información identificable de jugadores.

## Reglas antes de modificar

1. Leer [`AGENTS.md`](AGENTS.md) y [`docs/PRODUCT.md`](docs/PRODUCT.md).
2. Crear una branch por problema.
3. No añadir funcionalidad sin una instrucción expresa.
4. Mantener `sin dato ≠ 0` y una sola fuente de verdad.
5. Ejecutar `npm run check`.
6. Revisar visualmente Staff desktop/tablet y Player mobile.

## Documentación esencial

- [Producto](docs/PRODUCT.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Métricas](docs/METRICS.md)
- [Modelo de datos](docs/DATA_MODEL.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Principios UX](docs/UX_PRINCIPLES.md)
- [Rutas y pantallas](docs/ROUTES.md)
- [Componentes](docs/COMPONENTS.md)
- [Seguridad](docs/SECURITY.md)
- [Deuda técnica](docs/TECH_DEBT.md)
- [Problemas conocidos](docs/KNOWN_ISSUES.md)
- [Roadmap](docs/ROADMAP.md)
- [Handoff](docs/HANDOFF.md)
- [Baseline y auditoría](docs/BASELINE.md)

## Licencia y marca

Repositorio privado, sin licencia de redistribución. La marca, logotipos y activos UCAM deben utilizarse únicamente con autorización institucional y conforme a su identidad visual.
