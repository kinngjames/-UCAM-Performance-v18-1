# Inventario de componentes

## Estado actual

La mayoría de componentes vive aún en `app/page.tsx`. Los nombres de esta lista describen responsabilidades funcionales, no una estructura ya totalmente modularizada.

## Shell y acceso

- Splash/login UCAM, acceso Player y acceso Staff.
- Resolución de sesión/rol y shell Staff o Player.
- Sidebar Staff con icono + texto, barras inferiores Staff/Player y un buscador global.

## HOY

- Contexto del día/sesión/MD.
- Resumen de disponibilidad.
- Atención Primero y acciones de revisión.
- Pendientes operativos.
- Estado/tendencia colectiva y cambios recientes.

## Equipo y jugadores

- Resumen colectivo de disponibilidad y registros sin mosaicos de estados normales.
- Lista compacta de equipo ordenada por relevancia con búsqueda, alcance y posición.
- `TeamWorkspace` con pestañas `Estado` (primaria) y `Gestionar plantilla` (secundaria), sin otra entrada de navegación.
- Directorio estable con activos/archivados, alta/importación y acceso contextual a ficha.
- Panel de gestión administrativa con información, acceso/PIN y acciones de plantilla claramente separadas; protege cambios sin guardar.
- Selector/cambio rápido de jugador.
- Ficha profesional y explorador de variables.
- Carga/exposición, bienestar, dolor y timeline.

## Sesiones

- Selector compacto de jornada/sesión con fecha, MD, estado y pendientes.
- Cabecera operativa con contexto, duración prevista y editor secundario.
- Control de cierre persistente con minutos, RPE e incoherencias pendientes.
- Participación unificada y acciones masivas para aplicar la normalidad una sola vez.
- Plantilla filtrable por prioridad, excepciones o totalidad; edición inline de minutos y RPE.
- Sesión cerrada en modo lectura y reapertura explícita para correcciones.
- Gestión de partido/participación.
- Formularios Player RPE y bienestar.

## Análisis y gráficos

- Evolución temporal con tooltip contextual.
- Carga entrenamiento/competición/total.
- Barras/rankings operativos.
- Sparklines y selector de bienestar.

## Informes

- Preentrenamiento.
- Resumen semanal.
- Informe individual Player-facing.

## Administración

- Alta/importación, gestión de jugadores y acceso/PIN viven únicamente en Equipo → Gestionar plantilla.
- Staff autorizado y roles.
- Temporada/equipo, umbrales y marca.
- Importación/exportación y modo DEMO.

## Estrategia de extracción

No extraer todo de una vez. Orden recomendado:

1. Asegurar tests de caracterización de métricas/roles.
2. Extraer tipos y selectores de datos.
3. Extraer HOY y Player Profile como módulos sin cambio visual.
4. Separar formularios/mutaciones de componentes de presentación.
5. Cargar gráficos e histórico de forma progresiva.

Cada extracción debe conservar cálculo, permisos, contexto y render responsive.
