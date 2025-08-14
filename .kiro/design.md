# Diseño del Sistema - Gestor de Migraciones DB

## Arquitectura General

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Tauri Core     │    │   PostgreSQL    │
│   React + TS    │◄──►│   Rust Backend   │◄──►│   (Neon)        │
│                 │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Estructura del Proyecto

```
src/
├── components/           # Componentes React
│   ├── MigrationList/   # Lista de migraciones
│   ├── MigrationEditor/ # Editor de SQL
│   ├── DiffViewer/      # Visualizador de diferencias
│   └── BackupManager/   # Gestión de backups
├── hooks/               # Custom hooks
├── services/            # Servicios de API
├── types/               # Definiciones TypeScript
└── utils/               # Utilidades

src-tauri/src/
├── commands/            # Comandos Tauri
├── database/            # Módulo de base de datos
├── migrations/          # Lógica de migraciones
├── backup/              # Sistema de backups
└── utils/               # Utilidades Rust
```

## Modelo de Datos

### Tabla: migrations_log
```sql
CREATE TABLE migrations_log (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    script_content TEXT NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    applied_by VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    execution_time_ms INTEGER,
    error_message TEXT,
    rollback_script TEXT
);
```

### Tabla: database_backups
```sql
CREATE TABLE database_backups (
    id SERIAL PRIMARY KEY,
    snapshot_id VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    file_path VARCHAR(500),
    file_size_bytes BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    schema_version VARCHAR(50),
    tables_count INTEGER,
    is_automatic BOOLEAN DEFAULT FALSE
);
```

## Componentes Frontend

### 1. MigrationDashboard
- Vista principal con resumen de estado
- Lista de migraciones pendientes y aplicadas
- Botones de acción rápida

### 2. MigrationEditor
- Editor de código SQL con syntax highlighting
- Validación en tiempo real
- Preview de cambios
- Botones para dry-run y aplicar

### 3. DiffViewer
- Comparación visual entre esquemas
- Highlighting de cambios destructivos
- Estimación de tiempo de ejecución
- Advertencias de riesgo

### 4. BackupManager
- Lista de backups disponibles
- Creación de nuevos backups
- Restauración con confirmación
- Información de tamaño y fecha

## API Commands (Tauri)

### Migraciones
```rust
#[tauri::command]
async fn create_migration(name: String) -> Result<Migration, String>

#[tauri::command]
async fn get_migrations() -> Result<Vec<Migration>, String>

#[tauri::command]
async fn apply_migration(id: i32, dry_run: bool) -> Result<MigrationResult, String>

#[tauri::command]
async fn get_migration_diff(id: i32) -> Result<SchemaDiff, String>
```

### Backups
```rust
#[tauri::command]
async fn create_backup(description: String) -> Result<Backup, String>

#[tauri::command]
async fn get_backups() -> Result<Vec<Backup>, String>

#[tauri::command]
async fn restore_backup(backup_id: String) -> Result<RestoreResult, String>

#[tauri::command]
async fn delete_backup(backup_id: String) -> Result<(), String>
```

## Flujo de Trabajo

### Aplicar Migración
1. Usuario selecciona migración pendiente
2. Sistema genera diff automáticamente
3. Usuario revisa cambios en DiffViewer
4. Opción de dry-run para validar
5. Confirmación para aplicar
6. Backup automático (opcional)
7. Ejecución de migración
8. Actualización de estado y logs

### Crear Backup
1. Usuario solicita backup
2. Sistema valida conexión a DB
3. Generación de snapshot
4. Almacenamiento seguro
5. Registro en tabla de backups
6. Notificación de éxito

## Consideraciones de UX

### Estados de Carga
- Spinners para operaciones largas
- Progress bars para backups/restore
- Feedback inmediato para acciones

### Manejo de Errores
- Mensajes de error claros y accionables
- Logs detallados para debugging
- Opciones de retry para fallos temporales

### Accesibilidad
- Navegación por teclado
- Contraste adecuado
- Textos alternativos para iconos
- Soporte para lectores de pantalla

## Tecnologías y Dependencias

### Frontend
- React 18 + TypeScript
- Vite para build
- TailwindCSS para estilos
- Monaco Editor para SQL
- React Query para estado del servidor

### Backend
- Tauri 2.0
- tokio-postgres para DB
- serde para serialización
- sqlx para queries tipadas
- chrono para fechas

### Base de Datos
- PostgreSQL 15+
- Conexión via Neon
- Pool de conexiones
- Transacciones ACID