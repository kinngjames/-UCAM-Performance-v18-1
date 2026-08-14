# Golden v18 ORIGINAL · formato v2

El snapshot v2 sustituye operativamente al golden histórico perdido. No afirma
reproducir sus bytes.

- Commit base: `135f15a0f7a69b59e165d5fd60de64a3a0cc0b21`.
- Dataset canónico: `2d30cadd2469c1a6e4c3eef2331a92bf424795ff50826d319a2b1c57150a509b`.
- SHA histórico perdido: `990cb9139bdb32696898d0bc18bd822c7e73d30c8649fcfcc5f61d4fd8ef81fd`.
- Golden v2: `tests/fixtures/v18-original-player-metrics.v2.json`.
- SHA golden v2: `c24421e7afed99ee483930a340e724440d8285a361fa26b2673622de69d5b7b4`.

## Contrato

`scripts/canonical-json.mjs` es la única serialización: claves recursivamente
ordenadas, arrays en orden semántico explícito, UTF-8, dos espacios, `null`
preservado, `undefined` rechazado y LF final.

El generador exige al arrancar el SHA del dataset aprobado y el locale explícito
`es-ES`. El entorno principal usa Node `24.19.0`. ICU no se fija como dependencia
separada: el test exige la versión `78.3` y el texto real producido por
`domain/metrics/format.ts`. La comprobación de portabilidad usa además Node `22.13.0` con locale
ambiental `C`.
