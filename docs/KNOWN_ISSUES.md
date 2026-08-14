# Problemas conocidos

## Funcionales/entorno

- El acceso Staff/Player de la aplicación desplegada usa credenciales DEMO; un navegador con estado antiguo puede requerir cerrar sesión o limpiar cookies antes de probar otro rol.
- Si el binding D1 `DB` no está disponible, las rutas persistentes no pueden reproducir el entorno Work completo.
- Los assets UCAM se obtienen de URLs externas; un bloqueo/red caída puede ocultarlos.
- La aplicación sigue identificada como DEMO y no debe recibir datos reales sin completar la fase de producción.

## Cálculos y datos

- La planificación individual de partido usa valores DEMO fijos (titular/suplente); no es una regla universal.
- Baseline requiere cinco registros previos; jugadores nuevos mostrarán referencia no disponible.
- Las métricas avanzadas dependen de semanas suficientes y pueden devolver “Sin dato”. Es intencional.
- Parte del contrato matemático vive todavía en `app/page.tsx`; existe riesgo de divergencia hasta centralizarlo.

## Rendimiento/mantenibilidad

- La carga inicial incluye un dataset DEMO grande y un componente cliente monolítico.
- Algunos chunks superan la recomendación de 500 KB.
- No hay paginación/virtualización completa para escenarios de 100+ jugadores.
- v18 añade contratos para plantilla dinámica, completitud, navegación, guardado, minutos desconocidos y archivado; todavía falta una suite E2E autenticada exhaustiva para todos los permisos y fallos de red.

## Dependencias

La auditoría de npm de esta baseline detecta cuatro avisos transitorios high. Deben verificarse contra versiones nuevas en una branch separada y con build/E2E; no se ocultaron ni se forzó una actualización masiva en el cierre.

## No considerados defectos

- `Sin dato` no se dibuja como cero.
- Alertas no diagnostican ni recomiendan tratamiento.
- Player no ve notas internas ni información de compañeros.
