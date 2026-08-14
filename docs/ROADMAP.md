# Roadmap de ingeniería y productización

No añadir módulos importantes antes de completar las fases 1–12.

## 1. Auditoría técnica completa

- Reproducir baseline, inventariar módulos, dependencias, rutas y contratos.
- Crear tests de caracterización de métricas, roles y mutaciones críticas.
- Medir bundle, renders, consultas y latencia.

## 2. Arquitectura y refactor crítico

- Extraer dominio/métricas de UI.
- Dividir `page.tsx` y CSS por feature sin rediseño.
- Establecer data access/services y rutas URL estables.

## 3. Carga — perfeccionamiento

- Validación matemática cruzada.
- Consolidar exposición y series con contratos explícitos de dato faltante.
- Convertir supuestos DEMO en configuración explícita.

## 4. Sesiones — optimización operativa

- Medir clics de abrir→asistencia→minutos→RPE→cierre.
- Consolidar edición por defecto/excepciones y trazabilidad.

## 5. Gráficos — auditoría global

- Pregunta, escala, huecos, tooltip, mobile y rendimiento por gráfico.
- Carga progresiva y reducción de puntos cuando no altera significado.

## 6. Equipo/plantilla — perfeccionamiento

- Escaneo 20–30 y prueba 100 jugadores.
- Contexto persistente y retorno.

## 7. Informes

- Narrativa, consistencia matemática, impresión/exportación y privacidad.

## 8. Simulación de temporada completa

- 20–40 semanas, partidos, incompletos, cambios de temporada y archivado.

## 9. QA matemático

- Fixtures de referencia para cada fórmula y comparaciones cruzadas.

## 10. Performance

- Consultas específicas, caché, bundle, memoización y gráficos.

## 11. Responsive

- Matriz 320/375/430, tablet, desktop y navegadores objetivo.

## 12. Accesibilidad

- Teclado, focus, labels, contraste, touch targets y lectores.

## 13. Piloto con preparadores físicos

- Tareas reales, tiempo, errores, comprensión y feedback documentado.

## 14. UCAM Performance v1.0

- Alcance congelado, criterios de aceptación, manual operativo y release candidate.

## 15. Infraestructura de producción

- Proveedor auth, PostgreSQL, migración, backups, observabilidad, privacidad, demo/staging/prod y despliegue controlado.

## Flujo obligatorio

```text
problema → análisis → hipótesis → branch → implementación
→ navegador → tests → revisión visual → comparación → commit o descarte
```
