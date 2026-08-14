# Deuda técnica

Prioridades: P0 bloquea seguridad/datos/uso; P1 alto impacto; P2 mantenibilidad o pulido.

## P0

- **Autenticación DEMO no apta para producción.** Email+código y PIN de demostración deben sustituirse por un sistema auditado antes de datos reales.
- **Dataset identificable en la baseline Work.** La entrega compartible debe usar el paquete anonimizado; revisar obligaciones de privacidad si los datos originales fueran reales.
- **Revisión de dependencias.** `npm audit --omit=dev` informa 4 vulnerabilidades transitorias high (familias `nanoid/postcss` y `sharp/libvips`). No aplicar `audit fix` sin probar; actualizar en branch dedicada.

## P1

- **Monolito UI.** `app/page.tsx` supera las 10.000 líneas y concentra navegación, estado, cálculos y vistas.
- **CSS monolítico.** `app/globals.css` supera las 13.000 líneas; existen estilos heredados y riesgo de colisiones.
- **Orquestador métrico todavía en UI.** Tipos, primitivas y señales viven en `domain/metrics/`, pero `buildMetrics` sigue temporalmente en `app/page.tsx`.
- **Dataset DEMO acoplado a código.** `app/data.ts` es grande y aumenta bundle/tiempo de parseo.
- **Cobertura incompleta.** v18 incorpora pruebas de contrato estructural además de métricas/render; faltan E2E autenticados de auth/roles, fallos de red y mutaciones cruzadas.
- **Chunk cliente grande.** El build ha advertido bundles superiores a 500 KB; medir antes de extraer/cargar de forma progresiva.
- **Routing interno.** v18 restaura el contexto funcional con estado elevado, referencias de retorno y `sessionStorage`, pero las pantallas aún no tienen URLs estables/deep links completos.
- **Assets de marca externos.** Logo UCAM depende de URLs remotas y de autorización/licencia.
- **Planificación de partido hardcodeada.** 540/140 UA son supuestos DEMO y deben ser configuración o planificación explícita.

## P2

- Componentes legacy sin uso claro (`LegacyTodayDashboard`, `LegacyPlayerDetail`, `LegacyHome` y otros candidatos) deben eliminarse solo tras coverage/confirmación visual.
- Los datos, tipos y selectores están repartidos entre `data.ts`, `phase2-data.ts`, `page.tsx` y servidor.
- Conviene estandarizar formatter de fechas/números y tokens CSS ejecutables.
- Falta instrumentación real de rendimiento, errores y consultas.
- La importación/exportación necesita pruebas con archivos grandes y validación más visible.
- D1/SQLite y Vinext/Sites son acoplamientos actuales; la migración a PostgreSQL/hosting externo necesita ADR y plan, no reescritura.

## Regla de tratamiento

No resolver varias deudas a la vez. Añadir tests de caracterización, cambiar una capa, comparar visual/funcionalmente y mantener un commit reversible.
