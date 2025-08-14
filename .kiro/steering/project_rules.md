---
inclusion: always
---

# Reglas del Proyecto - Sistema de Migraciones de Base de Datos

## Arquitectura del Proyecto
- **Backend**: Rust con Tauri y conexión a Neon Postgres
- **Frontend**: React + TypeScript + Vite
- **Base de datos**: PostgreSQL (Neon)

## Reglas de Desarrollo

### Migraciones de Base de Datos
- **NUNCA** modificar scripts de migración sin aprobación explícita del usuario
- Si el diff detecta operaciones destructivas (`DROP TABLE`, `DROP COLUMN`, etc.), **ALERTAR y DETENER** antes de aplicar
- Todas las migraciones deben ser reversibles cuando sea posible
- Usar checksums para verificar integridad de scripts

### Seguridad y Validación
- Las pruebas del backend deben pasar antes de ejecutar migraciones en producción
- Toda acción crítica (backup/restore) debe pedir confirmación en UI
- Implementar dry-run para todas las migraciones
- Logs detallados de todas las operaciones

### Flujo de Trabajo
- El agente puede proponer cambios en documentación o tests
- **ESPERAR revisión manual** antes de hacer commits automáticos
- Usar hooks para automatizar linting y testing en archivos SQL
- Mantener documentación actualizada automáticamente

### Estándares de Código
- Rust: Seguir convenciones estándar, usar `cargo fmt` y `cargo clippy`
- TypeScript: Usar ESLint y Prettier
- SQL: Usar nombres descriptivos, comentarios para cambios complejos

### UI/UX Standards
- **OBLIGATORIO**: Usar ÚNICAMENTE componentes de shadcn/ui para toda la interfaz
- **NO** crear componentes personalizados si existe equivalente en shadcn/ui
- Mantener consistencia con el tema dark mode configurado
- Usar las clases de Tailwind CSS que vienen con shadcn/ui
- Seguir los patrones de composición de shadcn/ui (Card + CardHeader + CardContent, etc.)