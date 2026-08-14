# Design system UCAM Performance

## Dirección visual

Institucional, deportiva, sobria y operativa. La marca estructura la experiencia; los colores funcionales explican estados. No debe parecer un Excel, un dashboard financiero ni una interfaz “gamer”.

## Color

Los tokens ejecutables están en `app/globals.css`. Reglas de uso:

- **Azul UCAM:** navegación, cabeceras, selección y acción primaria.
- **Dorado/ocre:** acento institucional limitado; nunca color funcional principal.
- **Neutros:** fondo, superficies, bordes y texto secundario.
- **Verde:** `OK`/favorable cuando necesita destacarse.
- **Ámbar:** `VIGILAR`.
- **Rojo:** `REVISAR` o error real.
- **Gris:** neutral, inactivo o sin datos.

Nunca comunicar un estado solo con color: usar icono + texto + contexto.

## Tipografía

Stack: Open Sans o equivalente del entorno, con Arial/sans-serif como fallback. Myriad Pro solo si existe licencia y asset autorizado.

- Título de pantalla: uno por vista, fuerte y breve.
- Contexto: fecha, jornada y unidad con menor énfasis, contraste legible.
- Dato principal: cifras tabulares, sin decimales innecesarios.
- Etiqueta: corta, consistente y sin mayúsculas decorativas excesivas.
- Nota: nunca gris tan claro que pierda accesibilidad.

## Espaciado y forma

- Basar separación en múltiplos coherentes de 4/8 px.
- Usar 8, 12, 16, 24 y 32 px como escalas dominantes.
- Radio moderado y constante; las tarjetas no deben parecer burbujas.
- Sombras ligeras o ninguna; jerarquía por espacio, fondo y tipografía.
- Bordes solo para delimitar, no alrededor de cada dato.

## Botones

- **Primary:** una acción dominante por bloque/pantalla.
- **Secondary:** acciones importantes alternativas.
- **Tertiary/ghost:** navegación y acciones menores.
- Estados obligatorios: hover, focus visible, active, disabled y loading.
- Touch target mínimo recomendado: 44×44 px.

## Inputs y formularios

- Label persistente; placeholder no sustituye label.
- Error junto al campo, humano y accionable.
- RPE y bienestar Player usan controles grandes, una decisión por paso y confirmación clara.
- Staff usa defaults y edición de excepciones para reducir trabajo repetitivo.

## Superficies y cards

Cards solo para acción, alerta o resumen que necesita contención. Información secundaria usa filas, grupos, separadores y tipografía. Evitar mosaicos de tarjetas con igual peso.

## Badges

Pocos, pequeños y semánticos:

- Disponibilidad: COMPLETO, MODIFICADO, RECUPERACIÓN, NO DISPONIBLE, AUSENTE.
- Monitorización: OK, VIGILAR, REVISAR, INCOMPLETO, SIN DATOS.
- Alertas: NUEVA, REVISADA, EN SEGUIMIENTO, CERRADA.

## Tablas y listas

- Tabla cuando mejora comparación; lista compacta para escaneo de plantilla.
- Números alineados y unidades visibles.
- Fila completa clicable cuando lleva a ficha.
- Cabecera fija solo si aporta en listas largas.
- Vista móvil reordena prioridades; no comprime todas las columnas.

## Gráficos

- Evolución: línea.
- Comparación: barras horizontales.
- Tendencia secundaria: sparkline.
- Planificado vs real: comparación directa y diferencia absoluta/%.
- Escalas fijas: RPE/dolor 0–10; ánimo/cansancio/estrés 1–5; sueño con escala coherente.
- No mezclar unidades incompatibles en el mismo eje.
- Hueco = sin dato; no interpolar de forma engañosa.
- Tooltip: jornada, sesión/MD, valor, unidad y contexto.
- Evitar 3D, gauge, radar y donut decorativo.
- El contrato transversal, inventario y comportamiento responsive viven en `DATA_VISUALIZATION.md`.
- Usar los tokens `--chart-*`; no introducir colores de serie aislados en componentes.
- Carga y minutos parten de cero; las escalas perceptivas solo se recortan cuando existe un dominio explícito y estable.
- Hover, foco y tap deben ofrecer el mismo contexto esencial.
- En móvil una visualización puede cambiar de forma: no se limita a reducir el SVG de escritorio.

## Responsive

- Player: mobile-first, navegación inferior y acción dominante.
- Staff: desktop/tablet-first, sidebar y densidad profesional.
- Breakpoints prácticos deben validarse al menos en 320, 375, 430 px, tablet y desktop.
- Móvil reordena y reduce información secundaria; no es desktop encogido.

## Assets y marca

El uso del logotipo UCAM requiere autorización. La baseline carga activos externos; antes de producción deben alojarse como assets versionados/autorizados y configurarse mediante `brand_settings`.
