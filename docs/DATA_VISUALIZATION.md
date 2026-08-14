# Sistema de visualización de datos

## Contrato

Cada visualización debe responder una pregunta explícita. La jerarquía es:

1. **Operativa:** valor, comparación o microtendencia que se interpreta sin explorar.
2. **Analítica:** evolución, composición o comparación temporal principal.
3. **Avanzada:** métricas descriptivas bajo demanda; nunca compiten con la lectura principal.

Convenciones ejecutables:

- entrenamiento: `--chart-training`;
- competición: `--chart-competition`;
- compensatoria: `--chart-compensatory`;
- planificación: `--chart-planned`, línea o marcador discontinuo;
- referencia personal: `--chart-reference`, línea discontinua etiquetada;
- hueco/sin dato: `--chart-missing`, nunca barra o punto en cero;
- escalas fijas: RPE y dolor 0–10; ánimo, cansancio y estrés 1–5;
- magnitudes acumulativas como carga y minutos parten de cero;
- color siempre se acompaña de texto, posición, forma o etiqueta.

## Inventario transversal auditado

Se auditaron 25 bloques de visualización activos. Los micrográficos repetidos se cuentan como un bloque funcional: EQUIPO, JUGADORES y EVOLUCIÓN podían montar alrededor de 140 SVG solo en sus listas para la plantilla DEMO de 20 jugadores.

| Zona | Pregunta | Decisión |
| --- | --- | --- |
| HOY · disponibilidad | ¿Cuántos pueden entrenar y cuáles son las excepciones? | Mantener como distribución textual accionable. |
| HOY · carga reciente | ¿Está cambiando la carga colectiva? | Sustituir línea completa por microtendencia de 6 jornadas + comparación escrita. |
| HOY · plan/real | ¿La sesión se acerca al plan? | Mantener comparación directa sin gráfico adicional. |
| EQUIPO · registros | ¿Faltan registros esperados? | Mostrar RPE `x/y`, bienestar `x/1` u opcional y pendientes, sin porcentaje combinado. |
| EQUIPO · carga por fila | ¿Cómo está cada jugador respecto a sí mismo? | Eliminar sparkline duplicado; mostrar diferencia vs. 4 anteriores. |
| JUGADORES · carga por fila | ¿La tendencia reciente es relevante? | Eliminar sparkline duplicado; mostrar dirección y etiqueta. |
| SESIONES · cierre | ¿Qué falta para cerrar? | Mantener checklist; no añadir gráficos. |
| CALENDARIO · mapa | ¿Dónde estamos en la temporada? | Mantener navegación temporal, no convertir en chart. |
| CARGA · origen actual | ¿De dónde viene la carga? | Mantener barra apilada con etiquetas directas. |
| CARGA · plan/real actual | ¿Se cumplió el plan? | Mantener barras comparables + diferencia absoluta y porcentual. |
| CARGA · evolución colectiva | ¿Cómo se construyó la carga? | Mantener y mejorar: barras apiladas + plan, selección táctil/teclado y móvil específico. |
| CARGA · origen por jugador | ¿Qué compone la carga individual? | Mantener microbarra en tabla ordenable. |
| CARGA · avanzado | ¿Qué aportan EWMA/monotonía/strain/ratio? | Mantener como tabla lazy bajo demanda; sin gráficos. |
| EVOLUCIÓN · matriz | ¿Quién y qué está cambiando? | Eliminar 5 sparklines por jugador; sustituir por valor + dirección + etiqueta. |
| FICHA · origen actual | ¿Qué parte es entrenamiento y competición? | Mantener barra apilada compacta. |
| FICHA · plan/real | ¿Cuál es la diferencia actual? | Mantener comparación directa. |
| FICHA · exposición 7/14/28 | ¿Cómo se acumulan los minutos? | Mantener tabla comparativa compacta. |
| FICHA · carga histórica | ¿Cómo evolucionan carga, origen y plan? | Mantener gráfico principal; añadir selección accesible y representación móvil por filas. |
| FICHA · minutos de partido | ¿Cuánto juega en cada partido? | Sustituir línea por columnas discretas con escala fija 0–90. |
| BIENESTAR · variable activa | ¿Cómo cambia respecto a su habitual? | Mantener una sola serie seleccionable y referencia personal. |
| DOLOR · evolución | ¿Con qué intensidad, zona y limitación reaparece? | Sustituir línea genérica por historial contextual de intensidad, zona y limitación. |
| HISTORIA · disponibilidad/eventos | ¿Qué ocurrió y cuándo? | Mantener storyline desplegable. |
| INFORME semanal · carga | ¿Cómo cambió la carga del equipo? | Mantener una única evolución con escala honesta. |
| INFORME individual Staff | ¿Qué tendencias explican la semana? | Sustituir explorador completo por dos microtendencias: carga y sueño. |
| PLAYER · evolución/informe | ¿Cómo cambian mis datos? | Mantener explorador en Mi evolución; simplificar Mi informe a carga y sueño. |

## Responsive e interacción

- Desktop: hover y foco actualizan un resumen contextual persistente.
- Tablet: objetivos táctiles y densidad intermedia; no depende del hover.
- Móvil: la carga apilada se transforma en filas comparables; no se encoge un SVG de escritorio.
- Los gráficos de línea admiten tap y foco y exponen un tooltip visible.
- Los puntos y periodos tienen `aria-label`; la cifra y la interpretación crítica existen también fuera del SVG.

## Rendimiento

- No se montan sparklines en matrices de 20–25 jugadores.
- Las métricas avanzadas de CARGA se renderizan únicamente al abrir el detalle.
- SESIONES sigue sin librería ni gráficos analíticos.
- Los informes individuales no montan el explorador completo.
- Los componentes usan SVG/CSS nativo y no incorporan una librería de charts al bundle.
