# Producto

## Qué es

UCAM Performance es una plataforma de monitorización de carga, bienestar, disponibilidad y exposición competitiva para equipos de fútbol. Nació de un Excel operativo y se rediseñó como software de trabajo diario para un preparador físico.

No es una herramienta diagnóstica ni un predictor de lesión. Organiza datos, detecta cambios explicables, prioriza revisiones y mantiene al profesional humano en control.

## Usuarios

- **PLAYER:** registra su RPE y bienestar y consulta únicamente su información, evolución e informe.
- **STAFF:** consulta y gestiona el equipo, sesiones, participación, carga, señales e informes.
- **ADMIN:** además administra equipo, temporada, jugadores, accesos y staff autorizado.

## Problemas que resuelve

- Saber en segundos qué ocurre antes, durante y después de una sesión.
- Reducir trabajo manual en asistencia, minutos y registros.
- Unificar entrenamiento y competición en una lectura semanal coherente.
- Entender a cada jugador respecto a su comportamiento habitual.
- Distinguir dato, señal, alerta, revisión y cierre.
- Conservar contexto histórico de disponibilidad, molestias, carga y exposición.

## Principios del producto

1. **Jugador contra sí mismo.** La referencia personal tiene prioridad sobre benchmarks genéricos.
2. **Excepciones sobre normalidad.** Lo normal se resume; lo que cambia se explica.
3. **Dato con contexto.** El valor actual se acompaña de periodo, unidad y referencia cuando existe.
4. **Simple primero.** Resumen → detalle → análisis avanzado.
5. **Sin diagnóstico.** Monitoriza y contextualiza; no prescribe ni predice lesiones.
6. **Humano en control.** Las alertas priorizan una conversación, no toman decisiones clínicas.
7. **Sin dato no es cero.** La ausencia de registro conserva su significado.
8. **Una sola fuente de verdad.** Las métricas deben coincidir en toda la aplicación.
9. **Menos, pero mejor.** Cada KPI y gráfico debe responder una pregunta concreta.
10. **Herramienta de trabajo.** La interfaz prioriza acción, velocidad y continuidad de contexto.

## Experiencia Staff

La navegación principal agrupa:

- **HOY:** centro de mando diario, sesión, disponibilidad, atención, pendientes, estado colectivo y cambios recientes.
- **EQUIPO:** una sola entrada con `Estado` como tarea frecuente y `Gestionar plantilla` como workflow administrativo secundario.
- **SESIONES:** planificación, apertura/cierre, asistencia, minutos, RPE, participación, incidencias y partidos.
- **CARGA:** carga de entrenamiento, competición y total; planificado vs real; evolución y métricas avanzadas bajo demanda.
- **INFORMES:** preentrenamiento, semanal e individual.
- **AJUSTES/ADMIN:** equipo, temporada, umbrales, marca, exportación y permisos de staff; no duplica la gestión de jugadores.

### HOY

HOY debe permitir en 20–30 segundos responder: qué hay hoy, quién puede entrenar, quién necesita atención y por qué, qué falta, cómo llega el equipo y qué ha cambiado. No es un dashboard enciclopédico: resume normalidad y ofrece enlaces directos a las excepciones y tareas.

### Jugador individual

La ficha está diseñada en tres niveles:

1. **5–10 segundos:** identidad, disponibilidad, monitorización, señal principal, carga, minutos, bienestar y dolor.
2. **30 segundos:** cambios recientes y contexto de carga/exposición.
3. **Análisis:** variables, evolución, timeline, registros y métricas avanzadas.

## Experiencia Player

Mobile-first y deliberadamente simple:

1. Acceso mediante nombre + PIN.
2. Entrada directa a **Tu próxima acción**.
3. Registrar RPE o bienestar con controles grandes.
4. Confirmación inequívoca.
5. Resumen semanal e informe propio, sin acceso a datos de compañeros ni notas internas.

## Funcionalidad existente

- Plantilla, ficha, temporadas, jornadas, calendario y sesiones S1–S4.
- Partidos, convocatoria, titularidad, suplencia, minutos y RPE postpartido.
- Asistencia y disponibilidad: completo, modificado, recuperación, no disponible y ausente.
- RPE, minutos y carga interna; entrenamiento, competición, compensatoria y total.
- Planificación de duración/RPE/carga y comparación planificado-real.
- Bienestar semanal: sueño, ánimo, cansancio, dolor, estrés y observaciones.
- Dolor con zona, intensidad, limitación, nota e histórico.
- Baseline personal, rango habitual, tendencias, z-score y análisis avanzado.
- Cumplimiento y rachas respetando los RPE realmente esperados.
- Alertas explicables con estados y revisiones persistentes.
- Informes preentrenamiento, semanal e individual.
- Roles, sesiones de usuario, auditoría y persistencia D1.
- Dataset DEMO coherente derivado de la temporada Excel de referencia.

## Fuera de alcance actual

GPS, distancia, velocidad, frecuencia cardiaca, tests, gimnasio, predicción de lesión, recomendaciones clínicas, notificaciones activas, SSO institucional y producción multiorganización completa. La arquitectura puede evolucionar hacia ellos, pero no deben añadirse sin una decisión de producto explícita.
