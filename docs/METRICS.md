# Contrato de métricas

Este documento describe el contrato vigente en UCAM Performance v18.1 hasta C5. Cualquier cambio de fórmula requiere tests de caracterización, revisión de producto y actualización simultánea de este documento.

## Convenciones

- **UA:** unidades arbitrarias de carga interna.
- **Semana/jornada actual:** la seleccionada en el contexto de la aplicación.
- **Dato válido:** número finito. `null`, `undefined` y registro ausente son **sin dato**, no cero.
- **Media:** media aritmética de valores válidos exclusivamente.
- **Desviación estándar muestral:** divisor `n−1`; se usa exclusivamente en los baselines personales de RPE y sueño para estimar su variabilidad subyacente.
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
- Implementación válida: `loadForCompleteEffort` devuelve `null` si falta RPE o minutos; no existe una ruta alternativa que impute ausencias.

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
- `load` es la suma de los componentes conocidos. Un componente ausente no
  suma y conserva `null` en su propio campo; `loadCompleteness` indica si esa
  suma está completa. El total conocido nunca convierte el componente
  almacenado en cero.

## Completitud jugador-semana

La clasificación se calcula sobre los esfuerzos esperados de una semana: sesiones con `ENTRENÓ`, partido con evidencia de participación y compensatoria declarada con evidencia de esfuerzo. En una compensatoria, minutos positivos o un RPE registrado bastan para reconocer que el esfuerzo existió; si falta el otro componente, el esfuerzo queda incompleto.

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

## Medias y cambios

### Semana anterior

Valor de la jornada inmediatamente anterior de la misma temporada, si existe.

### Variación semanal

```text
variación_% = (actual − anterior) / anterior × 100
```

- No se calcula si falta cualquiera de los valores o si el anterior es cero.

## Métricas retiradas en C5

`monotony` y `strain` no forman parte de `PlayerMetric` ni del contrato activo.

- No se construye un vector que trate sesiones, partido, compensatoria y un
  cero de relleno como si fueran siete días.
- No existe cálculo, señal, decisión, filtro, ordenación ni consumidor visible
  asociado a estas métricas.
- No se presenta un sustituto mientras no exista carga distribuida por días
  reales con un contrato defendible.

## Duración operativa de sesión

`plannedDuration` conserva exclusivamente la duración definida por el Staff. Se
usa como valor por defecto al crear o completar registros en lote. No se combina
con un RPE objetivo, no estima carga y no genera comparaciones plan-real.

## Baseline personal

- Ventana: últimas 8 semanas **anteriores** a la actual.
- Mínimo: 5 registros previos válidos.
- La semana actual nunca entra en su propia referencia.
- Implementado actualmente para RPE y sueño; el patrón puede extenderse solo con decisión explícita.

```text
media_personal = media(valores_previos)
SD_personal = sqrt(Σ(valor − media_personal)² / (n − 1))
rango_habitual = [media_personal − SD, media_personal + SD]
diferencia = valor_actual − media_personal
```

Si hay menos de 5 registros: “Referencia personal aún no disponible”. Con una sola observación no existe estimación de SD. Si `SD = 0`, el rango puede existir pero el z-score es `null`. No se inventa interpretación.

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
- La señal `rpe-z` exige simultáneamente `zRpe >= zScore` y `RPE actual − media personal >= 0,5`.
- `0,5` es inclusivo y se conserva como hipótesis funcional recalibrable con datos reales para evitar que diferencias pequeñas generen por sí solas una alerta. No es un MCID validado ni una conclusión clínica o fisiológica.

En el fixture adversarial, la retirada de `rpe-z` en R6 (`+0,38 RPE`) y R10
(`+0,35 RPE`) es deliberada: ambas diferencias quedan por debajo del umbral
funcional provisional de `0,5` aprobado para evitar que diferencias pequeñas
generen por sí solas una alerta. En R10, `pending = 1` y
`recordCompleteness = PARTIAL` permanecen intactos; pasa a `OK` porque ya no
existe una señal deportiva, no porque la completitud administrativa controle
el estado.

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

## Registros esperados

```text
RPE_esperados = nº sesiones con asistencia ENTRENÓ
RPE_realizados = nº de esas sesiones con RPE válido
bienestar_esperado = 1 para COMPLETO, MODIFICADO o RECUPERACIÓN
bienestar_esperado = 0 para NO DISPONIBLE o AUSENTE
pendientes = max(0, RPE_esperados − RPE_realizados)
             + (bienestar_esperado = 1 y bienestar incompleto ? 1 : 0)
```

- Descanso, lesionado o ausente no incrementan RPE esperados.
- RPE y bienestar se presentan por separado como oportunidades completadas/esperadas; no existe porcentaje combinado.
- `bienestar_esperado = 0` excluye el registro del recuento administrativo, pero no bloquea el formulario ni descarta un registro voluntario válido.
- La interfaz identifica ese caso como “Bienestar opcional esta semana” y conserva sueño, ánimo, cansancio, dolor y estrés para monitorización.
- No existe racha ni índice sustituto derivado de estos registros.

La completitud administrativa se expone en un eje propio:

| `recordCompleteness` | Contrato |
| --- | --- |
| `COMPLETE` | Todas las oportunidades esperadas están completadas. |
| `PARTIAL` | Hay al menos una oportunidad completada y otra esperada pendiente. |
| `NO_DATA` | Hay oportunidades esperadas y ninguna está completada. |
| `NOT_EXPECTED` | No había ninguna oportunidad administrativa esperada. |

Un bienestar voluntario con `bienestar_esperado = 0` no altera `pending` ni convierte `NOT_EXPECTED` en completo. Sus cinco variables válidas sí permanecen disponibles para monitorización.

## Tendencias

- Requieren al menos 5 valores válidos.
- Comparan media de los 3 valores recientes con la media de los 3 anteriores.
- Cambio relativo menor al 4 % se etiqueta estable.
- Los huecos se excluyen; no se interpolan ni convierten en cero.
- Una tendencia debe moderarse/ocultarse si la calidad de datos no es suficiente.

## Monitorización

`status` representa exclusivamente monitorización deportiva:

1. `REVISAR`: existe una señal deportiva con severidad `review`.
2. `VIGILAR`: no existe revisión y sí una señal deportiva `watch`.
3. `null`: no existe señal deportiva y `recordCompleteness = NOT_EXPECTED`.
4. `OK`: resto de semanas sin señal deportiva.

Una señal deportiva siempre tiene prioridad sobre `NOT_EXPECTED`. Por tanto, un bienestar voluntario válido puede producir `VIGILAR` o `REVISAR` sin aumentar `pending`. `null` se presenta como `—`, nunca como `OK`, badge verde o aprobación implícita.

Disponibilidad, completitud administrativa y monitorización son ejes independientes. `pending` no participa en `status`.

## Alertas y revisiones

Flujo conceptual:

```text
DATO → SEÑAL → ALERTA → REVISIÓN → CIERRE
```

Una alerta conserva jugador, fecha, tipo, valor, referencia, motivo y estado (`NUEVA`, `REVISADA`, `EN SEGUIMIENTO`, `CERRADA`). Debe explicar por qué existe. Las señales y razones derivadas son exclusivamente deportivas; los registros pendientes viven en el eje administrativo. Una señal no equivale a diagnóstico.

## Presentación

- RPE: una decimal cuando sea promedio; escala 0–10.
- Sueño: una decimal y `h`.
- Minutos: entero y `min`.
- Carga: entero con separador de miles y `UA`.
- Porcentajes: entero salvo necesidad analítica explícita.
- Cualquier ausencia: “Sin dato”, no `0` ni una línea interpolada.
