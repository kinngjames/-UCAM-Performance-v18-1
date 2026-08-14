# Handoff a GitHub, Cursor y Codex

## Artefacto recomendado

Usar `UCAM_Performance_WORK_FINAL_BASELINE.zip`, generado desde el commit de baseline y anonimizado. No exportar `.git`, `node_modules`, `dist`, `.env`, bases D1 locales ni datos identificables.

## Crear el repositorio

```bash
unzip UCAM_Performance_WORK_FINAL_BASELINE.zip
cd ucam-performance-work-final
git init
git add .
git commit -m "chore: import Work Final Baseline"
git branch -M main
git tag work-final-baseline
git remote add origin <URL_PRIVADA_DEL_REPOSITORIO>
git push -u origin main --tags
```

El repositorio debe empezar privado. Verificar la autorización de marca UCAM antes de cualquier exposición pública.

## Verificación local

```bash
npm ci
cp .env.example .env.local
npm run check
npm run dev
```

Abrir la URL local indicada por Vite. Sin un binding D1 compatible, algunas rutas persistentes necesitarán el entorno Cloudflare local descrito en `wrangler.jsonc`.

## Primer trabajo en Cursor/Codex

1. Leer `AGENTS.md`, `PRODUCT.md`, `ARCHITECTURE.md`, `METRICS.md`, `TECH_DEBT.md` y `KNOWN_ISSUES.md`.
2. Confirmar `npm ci && npm run check` sin modificar dependencias.
3. Crear branch `chore/technical-baseline-audit`.
4. Conservar los oráculos golden/adversarial de `buildMetrics` y ampliar el aislamiento de roles con pruebas E2E.
5. Medir bundle/renders/consultas y publicar un informe reproducible.
6. No empezar el refactor hasta tener esos tests y mediciones.

## Estrategia de cambios

- Una branch por problema.
- Commits pequeños y reversibles.
- Captura visual antes/después para UI.
- PR con criterio de aceptación, tests y riesgos.
- No mezclar actualización de dependencias, refactor y cambio visual.

## Variables y secretos

`.env.example` es inventario, no configuración productiva. Los secretos se crean en GitHub/hosting y nunca se copian al repositorio. Separar development, demo, staging y production con bases y credenciales distintas.

## Datos

El ZIP entregado sustituye nombres y fechas de nacimiento por identificadores sintéticos manteniendo IDs, dorsales, posiciones, histórico y escenarios DEMO. Para importar una plantilla real, usar un canal seguro y un entorno privado; no incorporarla al historial Git.

## Desacoplar Work

`.openai/hosting.json` y la configuración Vinext/Sites preservan la baseline reproducible. Su retirada o sustitución debe hacerse posteriormente en una branch con build equivalente. No es necesario reconstruir el producto para moverlo a Vercel/Cloudflare u otra infraestructura.
