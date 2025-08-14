# Requerimientos del Sistema - Gestor de Migraciones DB

## Objetivo
Crear una aplicación de escritorio con Tauri que permita gestionar migraciones de base de datos PostgreSQL de forma segura y visual.

## Historias de Usuario

### 1. Gestión de Migraciones
**COMO** desarrollador  
**QUIERO** crear y aplicar migraciones de base de datos  
**PARA** mantener el esquema actualizado de forma controlada

**Criterios de Aceptación:**
- Crear nuevos scripts de migración con timestamp
- Aplicar migraciones de forma secuencial
- Registrar todas las migraciones aplicadas
- Mostrar estado actual de la base de datos

### 2. Vista Previa de Cambios
**COMO** desarrollador  
**QUIERO** ver un diff visual antes de aplicar migraciones  
**PARA** entender el impacto de los cambios

**Criterios de Aceptación:**
- Mostrar diferencias entre esquema actual y propuesto
- Destacar operaciones destructivas (DROP, ALTER con pérdida de datos)
- Permitir dry-run de migraciones
- Mostrar advertencias para cambios riesgosos

### 3. Sistema de Backups
**COMO** desarrollador  
**QUIERO** crear y restaurar snapshots de la base de datos  
**PARA** poder revertir cambios si algo sale mal

**Criterios de Aceptación:**
- Crear backups automáticos antes de migraciones importantes
- Crear backups manuales bajo demanda
- Listar y gestionar snapshots existentes
- Restaurar desde cualquier snapshot disponible

### 4. Interfaz Segura
**COMO** desarrollador  
**QUIERO** una interfaz que me proteja de errores  
**PARA** evitar pérdida accidental de datos

**Criterios de Aceptación:**
- Confirmaciones para operaciones destructivas
- Indicadores visuales de riesgo
- Historial de operaciones realizadas
- Posibilidad de cancelar operaciones en progreso

## Requerimientos Técnicos

### Backend (Rust + Tauri)
- Conexión segura a PostgreSQL (Neon)
- Endpoints para operaciones CRUD de migraciones
- Sistema de logging robusto
- Validación de scripts SQL
- Generación de checksums para integridad

### Frontend (React + TypeScript)
- Interfaz responsive y moderna
- Editor de código SQL con syntax highlighting
- Visualización de diffs
- Gestión de estado con Context API o Zustand
- Notificaciones y feedback visual

### Base de Datos
- Tabla de control de migraciones
- Tabla de backups y snapshots
- Índices para consultas eficientes
- Constraints para integridad de datos

## Endpoints de API

```
POST /api/migrations          # Crear nueva migración
GET  /api/migrations          # Listar migraciones
POST /api/migrations/apply    # Aplicar migración
POST /api/migrations/dry-run  # Simular migración
GET  /api/migrations/diff     # Obtener diff de cambios

POST /api/backups             # Crear backup
GET  /api/backups             # Listar backups
POST /api/backups/restore     # Restaurar backup
DELETE /api/backups/:id       # Eliminar backup
```

## Consideraciones de Seguridad
- Validación de entrada en todos los endpoints
- Sanitización de queries SQL
- Logs de auditoría para todas las operaciones
- Manejo seguro de credenciales de base de datos