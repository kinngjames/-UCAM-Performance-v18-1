# Seguridad y privacidad

## Modelo de acceso

- `PLAYER`: únicamente su perfil, sesiones, RPE, bienestar, evolución e informe.
- `STAFF`: datos y operaciones de los equipos a los que pertenece.
- `ADMIN`: además gestiona staff, jugadores, accesos y configuración del equipo.

Los permisos se validan en backend; ocultar una pantalla no autoriza una operación.

## Autenticación actual

- Player: nombre/directorio mínimo + PIN privado.
- Staff: email previamente incluido en `staff_permissions`; DEMO admite un código de prueba.
- Sesiones persistidas, revocables y con expiración mediante cookie segura.
- Intentos de acceso registrados/limitados.
- PIN/códigos almacenados como salt + hash, no texto reversible.

Los PIN y códigos incluidos en la semilla son **solo DEMO**. No representan autenticación lista para producción.

## Autorización

Cada endpoint sensible debe verificar:

1. sesión válida;
2. usuario/rol activo;
3. pertenencia a `team_id`;
4. temporada/equipo de la entidad;
5. para Player, igualdad con su `player_id`;
6. rol ADMIN en gestión de permisos.

Nunca aceptar `player_id`, `team_id` o rol del cliente sin cruzarlo con la sesión.

## Datos privados

Bienestar, dolor, disponibilidad y observaciones requieren mínimo acceso. Diferenciar:

- nota interna Staff: privada por defecto;
- nota visible para Player: requiere marca explícita.

No registrar PIN, cookies, bienestar completo ni secretos en logs. La auditoría puede conservar metadatos y cambios necesarios sin exponer credenciales.

## Secretos y entornos

- `.env*` está ignorado; `.env.example` solo contiene nombres y documentación.
- El binding `DB` se inyecta por plataforma.
- No versionar tokens, claves, dumps D1 ni credenciales.
- Separar DEVELOPMENT, DEMO y PRODUCTION por base de datos, variables y despliegue.

## Datos de la entrega

La aplicación Work conserva un dataset DEMO basado en el Excel. El paquete de handoff compartible se anonimiza: nombres y fechas de nacimiento identificables no deben publicarse. Ver `HANDOFF.md`.

## Trazabilidad

`audit_log` debe registrar permisos, RPE, bienestar, minutos, disponibilidad, umbrales, archivado y cualquier edición Staff sobre datos Player, incluyendo actor, fecha y valores anterior/nuevo cuando sea apropiado.

## Antes de producción

- Sustituir acceso DEMO por proveedor de identidad/sesiones auditado.
- Revisar hashing, expiración, CSRF, cookies y rate limits con threat model.
- Ejecutar pruebas de autorización horizontal/vertical.
- Rotar todas las credenciales y no reutilizar códigos DEMO.
- Configurar HTTPS, backups, restauración, retención y monitorización.
- Realizar revisión legal/privacidad para datos de deportistas y posibles menores.
- Alojar assets de marca autorizados y eliminar dependencias externas no controladas.

La baseline es una base funcional, no una certificación de seguridad de producción.
