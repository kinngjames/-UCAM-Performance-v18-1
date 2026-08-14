# Fixture adversarial v18 · defectos caracterizados

- Input SHA-256: `00fb9f767a9155d637ef5b68154d4f663db3b67a7f01e0a0442263b5ee76e23b`.
- Output v18 SHA-256: `aa5090b824c00635966fb42edc77f8fe544b093bf278ba8e4210ba4353d5bd6d`.
- Dataset base SHA-256: `2d30cadd2469c1a6e4c3eef2331a92bf424795ff50826d319a2b1c57150a509b`.
- Golden v2 inmutable: `c24421e7afed99ee483930a340e724440d8285a361fa26b2673622de69d5b7b4`.
- Alcance del oráculo: 2 jugadores sintéticos, 10 jugador-semana y 6 casos.

| Caso | Input mínimo relevante | Resultado roto v18 | Contrato esperado en Bloque 2 |
|---|---|---|---|
| C1 · lesionado sin bienestar | ADV-EDGE J6; `NO DISPONIBLE`; 4 asistencias `LESIONADO`; sin bienestar; `rpeExpected=0` | `compliance=0`; `pending=1`; `status=INCOMPLETO`; señal `pending` con `0/0 RPE`; `loadCompleteness=NO_EXPOSURE` | Eliminar porcentaje agregado y `streak`; separar RPE y bienestar por oportunidades realmente esperadas; no convertir `0/0` ni lesión/no exposición en incumplimiento. |
| C2 · plan 4 / asiste 2 | ADV-EDGE J7; 4 sesiones planificadas y 2 asistidas | Cada plan aporta `60×5=300 UA`; v18 suma solo los dos planes asociados a `trained`: `plannedTrainingLoad=600`; las dos sesiones reales aportan `60×6,3=378 UA` cada una: `trainingLoad=756` | `plannedTrainingLoad: 600 → 1200`; `trainingLoad: 756 → 756`. La corrección modifica exclusivamente el plan. |
| C3 · PARTIAL + ratio | ADV-EDGE J5; 2 esfuerzos esperados, 1 completo; carga `980 UA`; cuatro semanas completas previas de `1000 UA` | `loadCompleteness=PARTIAL`; `chronic=1000`; `ratio=0.98` | Semana `PARTIAL` produce `ratio=null`; el ratio queda como análisis secundario y solo para semana actual `COMPLETE`. |
| C4 · RPE con SD baja | ADV-STABLE: historial `6,0 · 6,3 · 6,0 · 6,3 · 6,0`; media `6,12`; SD poblacional `0,14697`; actual `6,5` | `zRpe=2,59`; `status=VIGILAR`; señal `rpe-z` (`z +2,6`) aunque la diferencia absoluta es `0,38` | Una diferencia trivial no genera señal por sí sola; aplicar contrato recalibrable de diferencia interpretable, ruido, mínimo de registros y persistencia. |
| C5 · S4 + compensatoria | ADV-STABLE J6; vector v18 `[390,390,390,390,0,150,0]`; carga `1710 UA`; comparación J5 de una ranura: `monotony=0,41`, `strain=147` | Con S4 y compensatoria: `monotony=1,40`; `strain=2394`; ambas aumentan al poblar más ranuras | Retirar monotonía y strain de UI, señales y decisiones; si el código sobrevive, queda explícitamente legacy/deprecated. |
| C6 · VIGILAR + pendiente | ADV-EDGE J8; RPE `6,5`; `zRpe=2,33`; bienestar incompleto (`stress=null`) | señales `rpe-z` (watch) + `pending` (info); `pending=1`; `compliance=50`; estado final `INCOMPLETO`; razones conservan ambas señales | Separar monitorización (`VIGILAR`) de calidad del dato (`faltan registros`); ninguna debe ocultar la otra. |

El output almacena los diez `PlayerMetric` completos generados por el motor v18
actual. No se corrige ni normaliza ningún campo del oráculo.

## C2 · inputs exactos

| Sesión | Plan: duración | Plan: RPE objetivo | Plan: carga | Asistencia | Real: minutos | Real: RPE | Real: carga |
|---|---:|---:|---:|---|---:|---:|---:|
| S1 | 60 min | 5,0 | 300 UA | Entrenó | 60 min | 6,3 | 378 UA |
| S2 | 60 min | 5,0 | 300 UA | Entrenó | 60 min | 6,3 | 378 UA |
| S3 | 60 min | 5,0 | 300 UA | Ausente | — | — | — |
| S4 | 60 min | 5,0 | 300 UA | Ausente | — | — | — |

Sesiones planificadas: `4`. Sesiones asistidas: `2`. El plan correcto es
`1200 UA`; v18 calcula `600 UA` porque itera sobre las sesiones asistidas. La
carga realizada es coherentemente `756 UA` y permanece inmutable en Bloque 2.
Como no hay carga de partido planificada en este caso, `plannedTotalLoad` replica
el cambio derivado `600 → 1200` sin alterar el aislamiento del defecto.

### Inversión del estado plan-real

| Contrato | `plannedTrainingLoad` | `trainingLoad` | Variación | `planState` |
|---|---:|---:|---:|---|
| v18 defectuoso | 600 UA | 756 UA | `(756−600)/600 = +26 %` | `Por encima de lo previsto` |
| Bloque 2 | 1200 UA | 756 UA | `(756−1200)/1200 = −37 %` | `Por debajo de lo previsto` |

La corrección debe invertir el signo de la variación y el estado mostrado sin
modificar la carga realizada. Esta inversión `+26 % → −37 %` y `Por encima →
Por debajo` es criterio explícito de aceptación de C2.

## Alcance de la sensibilidad 6/6

La prueba 6/6 verifica seis mutaciones esperadas, una por caso, y demuestra que
el oráculo distingue esos cambios concretos. No constituye cobertura exhaustiva
frente a cambios inesperados ni prueba que cualquier regresión futura vaya a
quedar detectada.
