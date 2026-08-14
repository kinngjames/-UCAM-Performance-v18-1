# Changelog

## UCAM Performance v18

- La plantilla persistente sustituye a los 20 jugadores codificados como fuente de runtime; jugadores activos y archivados se recuperan del servidor.
- Carga adopta cuatro estados de completitud y calcula la media principal/plan sobre la misma cohorte completa.
- Partido distingue minutos desconocidos de cero explícito mediante `minutes_recorded`.
- Equipo concentra `Estado` y `Gestionar plantilla`; desaparece Plantilla de la navegación principal.
- Se centralizan alta/importación, edición confirmada, validación de dorsal, acceso/PIN, archivado y reactivación.
- HOY y Equipo comparten un único contrato de filtros; los enlaces de sesión abren la sesión exacta.
- Volver desde jugador preserva pantalla, scroll y los estados elevados de Sesiones/Carga.
- Staff móvil usa barra inferior fija; tablet conserva icono + texto.
- Se eliminan controles falsos y se explicita autoguardado/estado persistente.
- Player Mode conserva la tarea exacta, exige bienestar completo y representa vacío como `Sin dato`.
- Se eleva la tipografía operativa y se simplifican las filas de Equipo.

## Handoff posterior a v18

- Extraer las vistas y el motor de métricas del monolito.
- Sustituir el routing interno por rutas URL/deep links completos sin perder el contrato de retorno.
- Añadir E2E autenticados sobre D1 para roles, fallos de red y concurrencia.
