# Aviso sobre el paquete exportado

El paquete de handoff se genera desde la WORK FINAL BASELINE y pasa por `scripts/anonymize-demo-data.mjs`.

- Los 20 jugadores y sus IDs/dorsales/posiciones se conservan.
- Nombre y fecha de nacimiento se sustituyen por datos sintéticos.
- Histórico, jornadas, escenarios y cálculos DEMO se mantienen.
- No se incluyen `.git`, `node_modules`, artefactos de build, `.env` ni bases locales.
- El archivo no debe tratarse como sistema apto para datos reales hasta completar `ROADMAP.md`.

La aplicación desplegada en Work no se modifica por este proceso; la anonimización se ejecuta únicamente sobre una copia de exportación.
