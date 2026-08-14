# Rutas y responsabilidades

La UI principal usa estado de navegación interno dentro de `app/page.tsx`; las rutas API sí son endpoints de servidor. Una prioridad futura es convertir las vistas importantes en rutas URL estables sin romper contexto.

## Pantallas Staff

| Vista | Responsabilidad | No debe duplicar |
| --- | --- | --- |
| HOY | Centro de mando diario: contexto, disponibilidad, atención, pendientes, estado y cambios. | Análisis avanzado o listados completos. |
| EQUIPO / ESTADO | Estado general de la plantilla activa, normalidad resumida, excepciones y motivo principal. | HOY, ficha completa o análisis profundo de carga. |
| EQUIPO / GESTIONAR PLANTILLA | Alta/importación, directorio, identidad, acceso/PIN, archivado y reactivación. Es secundaria dentro de Equipo. | RPE, bienestar, minutos o carga semanal. |
| FICHA | Comprender y analizar a un jugador. | Dashboard de equipo. |
| SESIONES / REGISTRO | Planificar, abrir, gestionar participación/minutos/RPE y cerrar. | Métricas avanzadas históricas. |
| CALENDARIO | Jornadas, fechas, MD, sesiones y partidos. | Edición masiva fuera de contexto. |
| CARGA | Equipo e individual: carga, origen, evolución y segundo nivel. | Tareas diarias de HOY. |
| EVOLUCIÓN | Cambios comparables de plantilla y tendencias. | Detalle exhaustivo individual. |
| INFORMES | Narrativa preentrenamiento, semanal e individual. | Dashboard duplicado. |
| AJUSTES | Equipo, temporada, umbrales, marca y configuración. | Operación diaria. |
| ADMIN | Staff autorizado, exportación, migración y permisos globales. | Gestión de jugador, centralizada en Equipo. |

## Pantallas Player

| Vista | Responsabilidad |
| --- | --- |
| INICIO | Próxima acción, semana y resumen mínimo. |
| REGISTRAR | RPE de sesión abierta o bienestar semanal. |
| MI EVOLUCIÓN | Tendencias propias accesibles. |
| MI INFORME | Vista propia y comprensible. |

Nunca contiene menús Staff ni selector manual de rol.

## API pública/autenticación

- `GET /api/public/players`: directorio mínimo para elegir Player.
- `POST /api/auth/player`: valida player + PIN.
- `POST /api/auth/demo-staff`: valida email autorizado + código en DEMO.
- `GET /api/auth/me`: sesión y rol actuales.
- `POST /api/auth/logout`: revoca/cierra sesión.

## API autenticada

- `GET /api/data`: estado permitido por rol/equipo/player.
- `POST /api/state`: mutaciones persistentes autorizadas.
- `GET /api/export`: exportación filtrada para Staff.
- `POST /api/import`: importación autorizada.
- `/api/admin/players`: alta, edición, archivo y acceso/PIN.
- `/api/admin/staff`: invitación, rol y desactivación, solo ADMIN.
- `/api/admin/migrate-demo`: semilla/migración controlada de DEMO.

## Reglas de navegación futura

- Una URL debe poder identificar al menos vista, temporada, jornada y jugador cuando corresponda.
- Los filtros transitorios pueden vivir en query params o store persistente, no duplicados por pantalla.
- Back debe restaurar filtros y posición de scroll.
- EQUIPO conserva pestaña, búsqueda/filtros y scroll al entrar en una ficha y volver.
- SESIONES conserva la sesión exacta, filtro y scroll; CARGA conserva jornada, orden, punto histórico, análisis avanzado y scroll.
- Los deep links nunca omiten autorización de backend.

## Navegación v18

- Desktop/tablet: `HOY · EQUIPO · SESIONES · CARGA · INFORMES · AJUSTES`; tablet mantiene icono + texto.
- Móvil Staff: barra inferior `HOY · EQUIPO · SESIONES · CARGA · MÁS`; Más contiene Informes y Ajustes.
- Calendario vive dentro de Sesiones; Tendencias dentro de Carga; ficha de jugador es contextual.
- v18 persiste el contexto funcional en estado elevado y `sessionStorage`. La migración a rutas URL completas permanece como handoff técnico.
