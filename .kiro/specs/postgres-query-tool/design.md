# Design Document - PostgreSQL Query Tool

## Overview

Una aplicación de escritorio construida con Tauri que proporciona una interfaz gráfica simple para conectarse y consultar bases de datos PostgreSQL alojadas en Neon. La arquitectura está diseñada para ser modular y extensible, permitiendo agregar funcionalidades avanzadas como gestión de migraciones en futuras iteraciones.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + TS)                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Connection  │  │   Query     │  │    Schema           │  │
│  │ Manager     │  │   Editor    │  │    Explorer         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Tauri Bridge    │
                    └─────────┬─────────┘
┌─────────────────────────────▼─────────────────────────────────┐
│                  Backend (Rust)                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Database    │  │   Query     │  │    Schema           │  │
│  │ Connection  │  │   Executor  │  │    Inspector        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  PostgreSQL       │
                    │  (Neon)           │
                    └───────────────────┘
```

## UI Component Library

### shadcn/ui Integration
**Decisión de diseño:** Todos los componentes de la interfaz utilizarán shadcn/ui para mantener consistencia y profesionalismo.

**Componentes principales utilizados:**
- **Button**: Para todas las acciones (ejecutar consultas, conectar, etc.)
- **Card**: Para contenedores de contenido (conexión, resultados, esquema)
- **Tabs**: Para navegación principal entre secciones
- **Alert**: Para mensajes de estado y notificaciones
- **Badge**: Para indicadores de estado de conexión
- **Input**: Para formularios de conexión
- **Table**: Para mostrar resultados de consultas
- **Dialog**: Para modales de confirmación
- **Select**: Para dropdowns de configuración

**Ventajas:**
- Componentes accesibles por defecto
- Tema dark mode integrado
- Consistencia visual automática
- Fácil personalización con CSS variables
- Componentes optimizados para performance

## Components and Interfaces

### Frontend Components

#### 1. ConnectionManager
**Responsabilidad:** Gestionar conexiones a la base de datos
- Formulario de conexión con campos para host, puerto, database, usuario, contraseña
- Validación de campos requeridos
- Indicador de estado de conexión
- Almacenamiento seguro de credenciales

**Props Interface:**
```typescript
interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error?: string;
}
```

#### 2. QueryEditor
**Responsabilidad:** Editor de consultas SQL con funcionalidades básicas
- Editor de código con syntax highlighting para SQL
- Botón de ejecución de consultas
- Historial de consultas ejecutadas
- Shortcuts de teclado (Ctrl+Enter para ejecutar)

**Props Interface:**
```typescript
interface QueryEditorProps {
  onExecuteQuery: (query: string) => void;
  isExecuting: boolean;
  queryHistory: string[];
}
```

#### 3. ResultsViewer
**Responsabilidad:** Mostrar resultados de consultas
- Tabla con paginación para resultados grandes
- Información de metadata (tiempo de ejecución, filas afectadas)
- Opciones de exportación (CSV, JSON)
- Manejo de diferentes tipos de datos

**Props Interface:**
```typescript
interface QueryResult {
  columns: ColumnInfo[];
  rows: any[][];
  executionTime: number;
  rowCount: number;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}
```

#### 4. SchemaExplorer
**Responsabilidad:** Explorar estructura de la base de datos
- Árbol de navegación con tablas y vistas
- Información detallada de columnas y constraints
- Conteo de filas por tabla
- Información de índices

### Backend Services

#### 1. DatabaseConnection
**Responsabilidad:** Gestionar conexiones a PostgreSQL
```rust
pub struct DatabaseConnection {
    pool: Option<Pool<Postgres>>,
    config: ConnectionConfig,
}

impl DatabaseConnection {
    pub async fn connect(&mut self, config: ConnectionConfig) -> Result<(), DatabaseError>;
    pub async fn disconnect(&mut self) -> Result<(), DatabaseError>;
    pub fn is_connected(&self) -> bool;
    pub async fn test_connection(&self) -> Result<(), DatabaseError>;
}
```

#### 2. QueryExecutor
**Responsabilidad:** Ejecutar consultas SQL
```rust
pub struct QueryExecutor {
    connection: Arc<DatabaseConnection>,
}

impl QueryExecutor {
    pub async fn execute_query(&self, query: &str) -> Result<QueryResult, DatabaseError>;
    pub async fn get_query_plan(&self, query: &str) -> Result<String, DatabaseError>;
}
```

#### 3. SchemaInspector
**Responsabilidad:** Inspeccionar estructura de la base de datos
```rust
pub struct SchemaInspector {
    connection: Arc<DatabaseConnection>,
}

impl SchemaInspector {
    pub async fn get_tables(&self) -> Result<Vec<TableInfo>, DatabaseError>;
    pub async fn get_table_columns(&self, table_name: &str) -> Result<Vec<ColumnInfo>, DatabaseError>;
    pub async fn get_table_indexes(&self, table_name: &str) -> Result<Vec<IndexInfo>, DatabaseError>;
    pub async fn get_foreign_keys(&self, table_name: &str) -> Result<Vec<ForeignKeyInfo>, DatabaseError>;
}
```

## Data Models

### Connection Configuration
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    pub password: String,
    pub ssl_mode: SslMode,
    pub connection_timeout: u64,
}
```

### Query Result
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct QueryResult {
    pub columns: Vec<ColumnInfo>,
    pub rows: Vec<serde_json::Value>,
    pub execution_time_ms: u64,
    pub rows_affected: u64,
    pub query_type: QueryType,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum QueryType {
    Select,
    Insert,
    Update,
    Delete,
    DDL,
    Other,
}
```

### Schema Information
```rust
#[derive(Debug, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
    pub schema: String,
    pub table_type: String,
    pub row_count: Option<i64>,
    pub size_bytes: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub default_value: Option<String>,
    pub is_primary_key: bool,
    pub is_foreign_key: bool,
}
```

## Error Handling

### Error Types
```rust
#[derive(Debug, thiserror::Error)]
pub enum DatabaseError {
    #[error("Connection failed: {0}")]
    ConnectionFailed(String),
    
    #[error("Query execution failed: {0}")]
    QueryFailed(String),
    
    #[error("Invalid SQL syntax: {0}")]
    InvalidSyntax(String),
    
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    
    #[error("Timeout: {0}")]
    Timeout(String),
}
```

### Error Handling Strategy
- Todos los errores de base de datos se capturan y se convierten a mensajes user-friendly
- Los errores de conexión incluyen sugerencias de troubleshooting
- Los errores de sintaxis SQL muestran la posición del error cuando sea posible
- Logging detallado para debugging sin exponer información sensible

## Testing Strategy

### Unit Tests
- **DatabaseConnection**: Pruebas de conexión, reconexión y manejo de errores
- **QueryExecutor**: Pruebas con diferentes tipos de consultas y casos edge
- **SchemaInspector**: Pruebas de extracción de metadata de diferentes esquemas

### Integration Tests
- Pruebas end-to-end con una base de datos PostgreSQL de prueba
- Pruebas de la interfaz Tauri con mocks del backend
- Pruebas de rendimiento con datasets grandes

### Frontend Tests
- Tests unitarios de componentes React con Jest y React Testing Library
- Tests de integración de la comunicación con Tauri
- Tests de usabilidad y accesibilidad

## Security Considerations

### Credential Management
- Las credenciales se almacenan usando el keyring del sistema operativo
- Nunca se almacenan credenciales en texto plano
- Conexiones SSL/TLS obligatorias para conexiones remotas

### SQL Injection Prevention
- Uso de prepared statements para todas las consultas
- Validación y sanitización de entrada del usuario
- Limitaciones en tipos de consultas permitidas (solo SELECT inicialmente)

## Performance Considerations

### Query Results
- Paginación automática para resultados > 1000 filas
- Streaming de resultados para consultas muy grandes
- Cache de metadata de esquema para mejorar rendimiento

### Connection Management
- Pool de conexiones para reutilización
- Timeout configurables para evitar conexiones colgadas
- Reconexión automática en caso de pérdida de conexión

## Future Extensibility

### Migration System Preparation
- Arquitectura modular que permite agregar nuevos servicios
- Abstracción de base de datos que soportará operaciones DDL
- Sistema de plugins para funcionalidades adicionales

### Planned Extensions
1. **Migration Manager**: Sistema completo de migraciones con versionado
2. **Backup System**: Creación y restauración de backups
3. **Query Builder**: Constructor visual de consultas
4. **Data Visualization**: Gráficos y dashboards básicos