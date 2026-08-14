# Contrato de métricas

Este documento describe el contrato vigente en UCAM Performance v18. Cualquier cambio de fórmula requiere tests de caracterización, revisión de producto y actualización simultánea de este documento.

## Convenciones

- **UA:** unidades arbitrarias de carga interna.
- **Semana/jornada actual:** la seleccionada en el contexto de la aplicación.
- **Dato válido:** número finito. `null`, `undefined` y registro ausente son **sin dato**, no cero.
- **Media:** media aritmética de valores válidos exclusivamente.
- **Desviación estándar:** poblacional, divisor `N`.
- **Redondeo:** cargas por esfuerzo se redondean al entero más cercano; valores de UI se formatean sin falsa precisión.

## Carga por esfuerzo

### Carga de sesión

```text
carga_sesión = RPE_sesión × minutos_reales
```

- Inputs: RPE 0–10 y minutos reales ≥ 0.
- Unidad: UA.
- Solo cuenta cuando la participación es `ENTRENÓ` y existen RPE y minutos.
- Ausente, descanso, lesionado o registro incompleto no generan una carga inventada.
- Implementación válida: `loadForCompleteEffort` devuelve `null` si falta RPE o minutos. `loadForEffort` queda como multiplicación de bajo nivel y solo se invoca tras validar ambos inputs.

### Carga de partido

```text
carga_partido = RPE_partido × minutos_jugados
```

- `0` minutos solo es válido cuando fue registrado explícitamente. `minutes_recorded = 0` se devuelve como `null`; sin RPE sigue siendo registro incompleto, no RPE cero.

### Carga compensatoria

```text
carga_compensatoria = RPE_compensatorio × minutos_compensatorios
```

- Se muestra separada cuando aporta contexto y suma a la carga total.

### Carga semanal

```text
carga_entrenamiento = Σ cargas S1..S4
carga_competición = carga_partido
carga_total = carga_entrenamiento + carga_competición + carga_compensatoria
```

- Periodo: jornada/semana seleccionada.
- Lugares: HOY, Carga, ficha, evolución e informes.

## Completitud jugador-semana

La clasificación se calcula sobre los esfuerzos esperados de una semana: sesiones con `ENTRENÓ`, partido con minutos positivos y compensatoria declarada.

| Estado | Definición exacta | Uso colectivo |
| --- | --- | --- |
| `COMPLETE` | Hay al menos un esfuerzo esperado y todos tienen minutos + RPE válidos. | Entra en la carga media principal. |
| `PARTIAL` | Existe al menos un esfuerzo completo, pero faltan datos en otro esfuerzo esperado. | Se muestra individualmente; no entra como equivalente a una semana completa. |
| `NO_EXPOSURE` | No hay esfuerzo esperado y existe evidencia explícita de no participación. | Cero real; se cuenta en cobertura, no en la media de expuestos. |
| `NO_DATA` | No existe evidencia suficiente, o falta todo dato de un esfuerzo esperado. | No entra en la media; se muestra como sin datos. |

```text
media_carga = media(carga_total de jugadores COMPLETE)
```

Siempre se presenta junto a `completos · parciales · sin exposición · sin datos`. Nunca se imputa cero a `PARTIAL` o `NO_DATA`.

## Planificación vs realizado

### Sesión prevista individual

```text
carga_prevista_sesión = duración_prevista × RPE_objetivo × factor_disponibilidad
```

Factores DEMO actuales:

| Disponibilidad | Factor |
| --- | ---: |
| COMPLETO | 1,00 |
| MODIFICADO | 0,68 |
| RECUPERACIÓN | 0,50 |
| NO DISPONIBLE / AUSENTE | 0,00 |

### Partido previsto individual

Suposiciones DEMO actuales: titular 540 UA, suplente 140 UA y no convocado 0 UA. Son convenciones de demostración, no una fórmula universal; deben convertirse en configuración/plan explícito antes de producción.

```text
diferencia_UA = carga_real − carga_prevista
diferencia_% = diferencia_UA / carga_prevista × 100
```

- Si `carga_prevista = 0`, no se calcula porcentaje.
- La diferencia es contexto de planificación, no alerta médica.
- La media de plan se calcula sobre exactamente la misma cohorte `COMPLETE` que la media realizada.

## Medias y cambios

### Semana anterior

Valor de la jornada inmediatamente anterior de la misma temporada, si existe.

### Media reciente / carga crónica descriptiva

```text
media_4_semanas = media(cargas_totales de las 4 semanas anteriores)
```

- Excluye la semana actual.
- Usa solo semanas válidas disponibles.
- Cada punto semanal conserva su cobertura. La UI usa un marcador de plan por semana, no una línea continua entre planes.

### Variación semanal

```text
variación_% = (actual − anterior) / anterior × 100
```

- No se calcula si falta cualquiera de los valores o si el anterior es cero.

## EWMA

```text
EWMA_t = α × carga_t + (1 − α) × EWMA_(t−1)
α = 0,4
```

- La primera carga válida inicia la serie.
- Unidad: UA.
- Indicador descriptivo de carga suavizada; no predictor clínico.

## Monotonía y strain

Vector semanal actual:

```text
[carga S1, S2, S3, S4, partido, compensatoria, 0]
```

```text
monotonía = media(cargas_diarias) / SD_poblacional(cargas_diarias)
strain = carga_total_semanal × monotonía
```

- Si `SD = 0`, monotonía y strain son `sin dato`.
- Son métricas avanzadas y no dominan HOY ni el resumen del jugador.

## Ratio de carga

```text
ratio_carga = carga_actual / media_4_semanas_previas
```

- No se calcula si la media previa no existe o es cero.
- Se presenta únicamente como **indicador descriptivo de cambio de carga**.
- Prohibido etiquetarlo como zona segura, riesgo o predictor de lesión.

## Baseline personal

- Ventana: últimas 8 semanas **anteriores** a la actual.
- Mínimo: 5 registros previos válidos.
- La semana actual nunca entra en su propia referencia.
- Implementado actualmente para RPE y sueño; el patrón puede extenderse solo con decisión explícita.

```text
media_personal = media(valores_previos)
SD_personal = SD_poblacional(valores_previos)
rango_habitual = [media_personal − SD, media_personal + SD]
diferencia = valor_actual − media_personal
```

Si hay menos de 5 registros: “Referencia personal aún no disponible”. No se inventa interpretación.

## Z-score

```text
z = (valor_actual − media_personal) / SD_personal
```

- No se calcula sin baseline o con `SD = 0`.
- Se usa como segundo nivel, especialmente para RPE y sueño.
- Umbral DEMO de señal: `|z|` según dirección y `zScore = 1,5` configurado; la regla visible debe explicar el dato y su referencia.

## RPE semanal

- RPE de entrenamiento: promedio de RPE válidos de sesiones entrenadas.
- Puede combinarse con contexto de partido en visualizaciones, manteniendo distinción entre entrenamiento y competición.
- Un RPE ausente no entra como cero en la media.

## Bienestar

Un registro semanal contiene:

- sueño: horas;
- ánimo: 1–5;
- cansancio: 1–5;
- dolor: 0–10;
- estrés: 1–5.

Se considera bienestar **completo** cuando existen las cinco variables. Promedios colectivos usan solo registros válidos y deben acompañarse de recuentos de excepciones; por ejemplo, jugadores bajo su referencia de sueño.

Umbrales DEMO actuales: RPE alto 8, sueño bajo 8 h, sueño crítico 6,5 h, ánimo bajo 2, cansancio alto 4, dolor relevante 4 y estrés alto 4.

## Exposición y competición

- Minutos competitivos: suma de minutos de partido del periodo.
- Exposición de 7/14/28 días: suma de minutos/registros incluidos en cada ventana disponible; entrenamiento y competición deben mantenerse distinguibles.
- Titularidad, convocatoria y suplencia son contextos, no puntuaciones.
- “Baja exposición” describe pocos minutos de partido; no constituye recomendación médica.

## Cumplimiento

```text
RPE_esperados = nº sesiones con asistencia ENTRENÓ
RPE_realizados = nº de esas sesiones con RPE válido
bienestar_esperado = 1 por semana
bienestar_realizado = 1 si las cinco variables existen, si no 0
cumplimiento_% = (RPE_realizados + bienestar_realizado)
                  / (RPE_esperados + 1) × 100
```

- Se redondea al entero más cercano.
- Descanso, lesionado o ausente no incrementan RPE esperados.
- Denominador protegido con mínimo 1 en la función pura.

### Racha

Número de semanas consecutivas hacia atrás con cumplimiento 100 %. La racha termina en la primera semana incompleta.

## Tendencias

- Requieren al menos 5 valores válidos.
- Comparan media de los 3 valores recientes con la media de los 3 anteriores.
- Cambio relativo menor al 4 % se etiqueta estable.
- Los huecos se excluyen; no se interpolan ni convierten en cero.
- Una tendencia debe moderarse/ocultarse si la calidad de datos no es suficiente.

## Monitorización

Prioridad actual:

1. `REVISAR`: existe una señal de revisión.
2. `INCOMPLETO`: falta un registro esperado.
3. `VIGILAR`: existe señal de vigilancia.
4. `SIN DATOS`: no hay entrenamiento ni bienestar interpretable.
5. `OK`: datos suficientes sin señales activas.

Disponibilidad y monitorización son ejes independientes: un jugador puede estar `COMPLETO` y `VIGILAR`.

## Alertas y revisiones

Flujo conceptual:

```text
DATO → SEÑAL → ALERTA → REVISIÓN → CIERRE
```

Una alerta conserva jugador, fecha, tipo, valor, referencia, motivo y estado (`NUEVA`, `REVISADA`, `EN SEGUIMIENTO`, `CERRADA`). Debe explicar por qué existe. Una señal no equivale a diagnóstico.

## Presentación

- RPE: una decimal cuando sea promedio; escala 0–10.
- Sueño: una decimal y `h`.
- Minutos: entero y `min`.
- Carga: entero con separador de miles y `UA`.
- Porcentajes: entero salvo necesidad analítica explícita.
- Cualquier ausencia: “Sin dato”, no `0` ni una línea interpolada.
