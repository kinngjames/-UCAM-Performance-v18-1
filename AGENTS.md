# Instrucciones para agentes

Estas reglas se aplican a todo el repositorio. Antes de cualquier cambio relevante, leer `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/METRICS.md` y el documento específico de la zona afectada.

## Protección del producto

- No añadir funcionalidades, métricas, alertas o variables sin una instrucción expresa.
- No borrar jugadores, histórico ni datos válidos. Para bajas, usar archivado o `active = false`.
- Mantener la separación de permisos `PLAYER` / `STAFF` / `ADMIN` en interfaz **y** backend.
- Un jugador solo puede leer y modificar sus propios datos. El staff solo opera sobre sus equipos.
- Las notas internas del staff son privadas por defecto.
- No diagnosticar lesiones, prescribir tratamientos ni presentar ratios como predictores de lesión.
- No usar ACWR como “zona segura”, “riesgo” o recomendación clínica.

## Datos y métricas

- Una sola fuente de verdad: no duplicar fórmulas por pantalla.
- `Sin dato` no es `0`. Conservar `null`/ausencia y no interpolar huecos de forma engañosa.
- Priorizar jugador contra su baseline personal; las comparaciones de equipo/posición son contexto.
- No inventar datos para rellenar gráficos o estados vacíos.
- Cualquier cambio matemático exige actualizar `docs/METRICS.md` y añadir tests de caracterización.
- Verificar que el mismo valor coincide en HOY, Jugador, Carga, Sesiones e Informes.

## UX y diseño

- Mantener identidad UCAM, superficies neutras y color funcional con texto + icono.
- Normalidad resumida; excepciones destacadas y explicables.
- Jerarquía: acción → estado → señal → tendencia → detalle → análisis avanzado.
- Evitar carditis, ruido de KPIs y gráficos decorativos.
- Mantener contexto de temporada, jornada, jugador, filtros y scroll cuando corresponda.
- Comprobar Staff en desktop/tablet y Player en móvil, incluyendo 320, 375 y 430 px.

## Método de trabajo

1. Definir el problema y el criterio verificable.
2. Crear una branch pequeña y enfocada.
3. Añadir tests de caracterización antes de refactors de lógica.
4. Implementar el cambio mínimo suficiente.
5. Ejecutar `npm run check`.
6. Revisar visualmente las rutas afectadas y estados sin datos/error/loading.
7. Documentar decisiones y deuda; no ocultar problemas conocidos.

No realizar refactors extensos mezclados con cambios de producto. Conservar compatibilidad con los datos DEMO y las migraciones existentes.
