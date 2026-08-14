# Modelo de datos

La baseline usa Drizzle sobre Cloudflare D1. `db/schema.ts` es la fuente ejecutable y este documento explica su intención. Todas las entidades deportivas están aisladas por equipo y, cuando corresponde, temporada, semana y jugador.

## Identidad y organización

| Entidad | Responsabilidad | Relaciones clave |
| --- | --- | --- |
| `users` | Persona autenticable; no equivale necesariamente a jugador. | Memberships, player opcional, permisos. |
| `teams` | Unidad de aislamiento de datos, zona horaria y modo DEMO/REAL. | Seasons, players, settings. |
| `seasons` | Periodo deportivo preservable/archivable. | Team, weeks, sessions, matches. |
| `team_memberships` | Relación usuario-equipo con rol. | Team + user únicos. |
| `staff_permissions` | Lista previa de emails autorizados, rol, invitación y estado. | Team, user opcional, invitador. |
| `auth_sessions` | Sesiones revocables y expirables. | User/player, role, team. |
| `login_attempts` | Control de intentos y rate limiting. | Identificador/fecha. |

## Jugadores

| Entidad | Responsabilidad |
| --- | --- |
| `players` | Identidad deportiva, dorsal, posición, nacimiento, pierna, avatar, acceso y archivado. |
| `player_week_status` | Disponibilidad/monitorización y contexto semanal. |
| `player_measurements` | Extensión tipada para mediciones futuras sin contaminar wellness. |
| `player_notes` | Notas internas o visibles, con autor y alcance. |

`players.user_id` es opcional. Esto conserva el histórico deportivo aunque cambie o se desactive la autenticación. Los jugadores no se eliminan físicamente: `active`, `archived_at` y `access_active` preservan los registros.

## Tiempo y actividad

| Entidad | Responsabilidad | Cardinalidad principal |
| --- | --- | --- |
| `weeks` | Jornada/semana numerada dentro de una temporada. | Season 1→N weeks. |
| `training_sessions` | S1–S4/compensatoria: fecha, MD, tipo, planificación y estado. | Week 1→N sessions. |
| `session_participation` | Asistencia, disponibilidad y minutos individuales. | Session N↔N players. |
| `session_rpe` | RPE persistente por jugador y sesión. | Único session+player. |
| `matches` | Rival, local/visitante, competición, jornada y resultado. | Week/season. |
| `match_participation` | Convocatoria, titularidad/suplencia, minutos, RPE y nota. | Único match+player. |

`match_participation.minutes_recorded` distingue un cero explícito de minutos desconocidos. La columna `minutes` conserva compatibilidad no nula en D1, pero la API devuelve `null` cuando `minutes_recorded = 0`.

Estados de sesión: `PLANIFICADA`, `ABIERTA`, `CERRADA`. Solo una sesión abierta/temporalmente permitida debe aceptar RPE de Player.

## Bienestar y dolor

| Entidad | Responsabilidad |
| --- | --- |
| `weekly_wellness` | Un registro por player+week: sueño, ánimo, cansancio, dolor, estrés y observaciones. |
| `pain_records` | Contexto de cada molestia: fecha, zona, intensidad, limitación y observación. |

El dolor resumido en wellness no sustituye el historial contextual. Los campos privados requieren mínimo acceso.

## Señales y configuración

| Entidad | Responsabilidad |
| --- | --- |
| `alerts` | Señal persistida con valor, referencia, motivo y estado. |
| `alert_reviews` | Actor, acción, nota y fecha de cada revisión. |
| `thresholds` | Umbrales configurables por equipo/temporada. |
| `team_settings` | Calendario, sesiones habituales y parámetros operativos. |
| `brand_settings` | Nombre, logo y colores desacoplados del producto. |
| `notification_queue` | Infraestructura futura; no implica notificaciones activas. |

## Trazabilidad

`audit_log` registra operaciones sensibles con actor, entidad, acción, valores anterior/nuevo, equipo y fecha. Debe cubrir al menos permisos, RPE, bienestar, minutos, disponibilidad, umbrales y archivado.

## Reglas de integridad

- Unicidad de dorsal por equipo, incluidos archivados, dentro del modelo actual. La UI valida antes de guardar y la API devuelve conflicto 409 como segunda barrera.
- Un RPE por jugador+sesión.
- Una participación por jugador+sesión o jugador+partido.
- Una semana por secuencia dentro de temporada.
- Todas las consultas deben filtrar por `team_id`; Player añade `player_id` de sesión.
- Fecha/hora se almacena de forma consistente y se presenta con la zona horaria del equipo.
- Soft delete/archivado para entidades con histórico.
- Métricas derivadas no se duplican si pueden calcularse de forma coherente.

## Datos DEMO y producción

El equipo incluye `data_mode`. El seed DEMO se genera desde `app/data.ts` y `app/phase2-data.ts`. Producción debe comenzar vacía o importar datos explícitamente; nunca debe mezclar registros simulados con reales.
