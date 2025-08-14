# Design Document - Connection String Manager

## Overview

Un sistema avanzado de gestión de cadenas de conexión que extiende la herramienta PostgreSQL Query Tool con capacidades robustas para guardar, organizar y reconectarse a múltiples bases de datos. El diseño se integra perfectamente con la arquitectura existente, añadiendo nuevos componentes especializados en gestión de conexiones mientras mantiene la modularidad y extensibilidad del sistema.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Frontend (React + TS)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Connection      │  │ Connection      │  │    Connection               │  │
│  │ Profile Manager │  │ Quick Selector  │  │    Health Monitor           │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Import/Export   │  │ Advanced Config │  │    Notification Center      │  │
│  │ Manager         │  │ Panel           │  │                             │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │   Tauri Bridge    │
                          └─────────┬─────────┘
┌─────────────────────────────────────▼─────────────────────────────────────────┐
│                           Backend (Rust)                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Connection      │  │ Credential      │  │    Health Check             │  │
│  │ Profile Store   │  │ Vault           │  │    Service                  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Connection      │  │ Import/Export   │  │    Notification             │  │
│  │ Pool Manager    │  │ Service         │  │    Service                  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │  System Keyring   │
                          │  + Local Storage  │
                          └───────────────────┘
```

## UI Component Library

### shadcn/ui Components for Connection Management
**Decisión de diseño:** Mantener consistencia con la herramienta existente usando exclusivamente shadcn/ui.

**Componentes específicos para gestión de conexiones:**
- **Command**: Para búsqueda rápida de conexiones guardadas
- **DropdownMenu**: Para acciones contextuales en perfiles de conexión
- **Sheet**: Para panel lateral de configuración avanzada
- **Toast**: Para notificaciones de estado de conexión
- **Progress**: Para indicadores de progreso de conexión
- **Separator**: Para organización visual de grupos de conexiones
- **ScrollArea**: Para listas largas de conexiones
- **Collapsible**: Para organización jerárquica de conexiones
- **Switch**: Para configuraciones booleanas (SSL, auto-connect, etc.)
- **Slider**: Para configuraciones numéricas (timeouts, pool size)

## Components and Interfaces

### Frontend Components

#### 1. ConnectionProfileManager
**Responsabilidad:** Gestión completa de perfiles de conexión
- CRUD operations para perfiles de conexión
- Organización por carpetas y tags
- Búsqueda y filtrado de conexiones
- Drag & drop para reorganización

**Props Interface:**
```typescript
interface ConnectionProfile {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  folder?: string;
  config: ConnectionConfig;
  metadata: ConnectionMetadata;
  createdAt: Date;
  lastUsed?: Date;
  useCount: number;
}

interface ConnectionMetadata {
  color?: string;
  icon?: string;
  isFavorite: boolean;
  autoConnect: boolean;
  environment: 'development' | 'staging' | 'production' | 'other';
}

interface ConnectionProfileManagerProps {
  profiles: ConnectionProfile[];
  onCreateProfile: (profile: Omit<ConnectionProfile, 'id' | 'createdAt' | 'useCount'>) => void;
  onUpdateProfile: (id: string, updates: Partial<ConnectionProfile>) => void;
  onDeleteProfile: (id: string) => void;
  onConnectToProfile: (id: string) => void;
}
```

#### 2. ConnectionQuickSelector
**Responsabilidad:** Acceso rápido a conexiones frecuentes
- Lista de conexiones recientes y favoritas
- Búsqueda instantánea con Command palette
- Indicadores de estado de salud
- Shortcuts de teclado

**Props Interface:**
```typescript
interface QuickSelectorProps {
  recentConnections: ConnectionProfile[];
  favoriteConnections: ConnectionProfile[];
  healthStatus: Map<string, ConnectionHealth>;
  onQuickConnect: (profileId: string) => void;
  onOpenProfileManager: () => void;
}

interface ConnectionHealth {
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  lastChecked: Date;
  responseTime?: number;
  errorMessage?: string;
}
```

#### 3. ConnectionHealthMonitor
**Responsabilidad:** Monitoreo de salud de conexiones
- Dashboard de estado de todas las conexiones
- Configuración de checks automáticos
- Historial de disponibilidad
- Alertas y notificaciones

**Props Interface:**
```typescript
interface HealthMonitorProps {
  connections: ConnectionProfile[];
  healthData: Map<string, ConnectionHealthHistory>;
  monitoringConfig: MonitoringConfig;
  onUpdateMonitoringConfig: (config: MonitoringConfig) => void;
  onManualHealthCheck: (profileId: string) => void;
}

interface ConnectionHealthHistory {
  current: ConnectionHealth;
  history: HealthCheckResult[];
  uptime: number; // percentage
}

interface MonitoringConfig {
  enableAutoCheck: boolean;
  checkInterval: number; // minutes
  enableNotifications: boolean;
  criticalConnectionIds: string[];
}
```

#### 4. ImportExportManager
**Responsabilidad:** Importación y exportación de configuraciones
- Exportación selectiva de perfiles
- Importación con validación y merge
- Formatos múltiples (JSON, encrypted)
- Backup automático

**Props Interface:**
```typescript
interface ImportExportProps {
  onExportProfiles: (profileIds: string[], includeCredentials: boolean) => void;
  onImportProfiles: (file: File, mergeStrategy: MergeStrategy) => void;
  onCreateBackup: () => void;
  onRestoreBackup: (file: File) => void;
}

enum MergeStrategy {
  Replace = 'replace',
  Merge = 'merge',
  Skip = 'skip'
}
```

#### 5. AdvancedConfigPanel
**Responsabilidad:** Configuración avanzada de conexiones
- Parámetros de conexión detallados
- Configuración de pools y timeouts
- SSL/TLS settings
- Variables de entorno

**Props Interface:**
```typescript
interface AdvancedConfigProps {
  profile: ConnectionProfile;
  onUpdateConfig: (config: AdvancedConnectionConfig) => void;
  onTestConnection: () => void;
  onResetToDefaults: () => void;
}

interface AdvancedConnectionConfig extends ConnectionConfig {
  connectionTimeout: number;
  queryTimeout: number;
  maxConnections: number;
  idleTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  sslConfig: SSLConfig;
  customParameters: Record<string, string>;
}

interface SSLConfig {
  mode: 'disable' | 'allow' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';
  cert?: string;
  key?: string;
  ca?: string;
}
```

### Backend Services

#### 1. ConnectionProfileStore
**Responsabilidad:** Persistencia y gestión de perfiles de conexión
```rust
pub struct ConnectionProfileStore {
    storage_path: PathBuf,
    profiles: HashMap<String, ConnectionProfile>,
}

impl ConnectionProfileStore {
    pub async fn load_profiles(&mut self) -> Result<Vec<ConnectionProfile>, StoreError>;
    pub async fn save_profile(&mut self, profile: ConnectionProfile) -> Result<(), StoreError>;
    pub async fn update_profile(&mut self, id: &str, updates: ProfileUpdates) -> Result<(), StoreError>;
    pub async fn delete_profile(&mut self, id: &str) -> Result<(), StoreError>;
    pub async fn get_profile(&self, id: &str) -> Result<ConnectionProfile, StoreError>;
    pub async fn search_profiles(&self, query: &str) -> Result<Vec<ConnectionProfile>, StoreError>;
    pub async fn get_profiles_by_tag(&self, tag: &str) -> Result<Vec<ConnectionProfile>, StoreError>;
}
```

#### 2. CredentialVault
**Responsabilidad:** Gestión segura de credenciales
```rust
pub struct CredentialVault {
    keyring: Keyring,
}

impl CredentialVault {
    pub async fn store_credentials(&self, profile_id: &str, credentials: Credentials) -> Result<(), VaultError>;
    pub async fn retrieve_credentials(&self, profile_id: &str) -> Result<Credentials, VaultError>;
    pub async fn delete_credentials(&self, profile_id: &str) -> Result<(), VaultError>;
    pub async fn update_credentials(&self, profile_id: &str, credentials: Credentials) -> Result<(), VaultError>;
    pub async fn list_stored_profiles(&self) -> Result<Vec<String>, VaultError>;
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Credentials {
    pub username: String,
    pub password: String,
    pub encrypted_at: DateTime<Utc>,
}
```

#### 3. HealthCheckService
**Responsabilidad:** Monitoreo de salud de conexiones
```rust
pub struct HealthCheckService {
    connection_manager: Arc<ConnectionPoolManager>,
    check_history: HashMap<String, Vec<HealthCheckResult>>,
}

impl HealthCheckService {
    pub async fn check_connection_health(&self, profile: &ConnectionProfile) -> Result<ConnectionHealth, HealthError>;
    pub async fn start_monitoring(&mut self, profile_ids: Vec<String>, interval: Duration) -> Result<(), HealthError>;
    pub async fn stop_monitoring(&mut self, profile_id: &str) -> Result<(), HealthError>;
    pub async fn get_health_history(&self, profile_id: &str) -> Result<Vec<HealthCheckResult>, HealthError>;
    pub async fn get_uptime_stats(&self, profile_id: &str, period: Duration) -> Result<UptimeStats, HealthError>;
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthCheckResult {
    pub timestamp: DateTime<Utc>,
    pub status: HealthStatus,
    pub response_time_ms: Option<u64>,
    pub error_message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum HealthStatus {
    Healthy,
    Warning,
    Error,
    Timeout,
}
```

#### 4. ConnectionPoolManager
**Responsabilidad:** Gestión avanzada de pools de conexión
```rust
pub struct ConnectionPoolManager {
    pools: HashMap<String, Pool<Postgres>>,
    configs: HashMap<String, PoolConfig>,
}

impl ConnectionPoolManager {
    pub async fn create_pool(&mut self, profile_id: &str, config: &AdvancedConnectionConfig) -> Result<(), PoolError>;
    pub async fn get_connection(&self, profile_id: &str) -> Result<PooledConnection<PostgresConnectionManager>, PoolError>;
    pub async fn close_pool(&mut self, profile_id: &str) -> Result<(), PoolError>;
    pub async fn get_pool_stats(&self, profile_id: &str) -> Result<PoolStats, PoolError>;
    pub async fn resize_pool(&mut self, profile_id: &str, new_size: u32) -> Result<(), PoolError>;
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PoolStats {
    pub active_connections: u32,
    pub idle_connections: u32,
    pub max_connections: u32,
    pub total_connections_created: u64,
    pub average_wait_time_ms: f64,
}
```

#### 5. ImportExportService
**Responsabilidad:** Importación y exportación de configuraciones
```rust
pub struct ImportExportService {
    profile_store: Arc<ConnectionProfileStore>,
    credential_vault: Arc<CredentialVault>,
}

impl ImportExportService {
    pub async fn export_profiles(&self, profile_ids: Vec<String>, include_credentials: bool) -> Result<ExportData, ExportError>;
    pub async fn import_profiles(&self, data: ExportData, merge_strategy: MergeStrategy) -> Result<ImportResult, ImportError>;
    pub async fn create_backup(&self) -> Result<BackupData, BackupError>;
    pub async fn restore_backup(&self, backup: BackupData) -> Result<RestoreResult, RestoreError>;
    pub async fn validate_import_data(&self, data: &[u8]) -> Result<ValidationResult, ValidationError>;
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportData {
    pub version: String,
    pub exported_at: DateTime<Utc>,
    pub profiles: Vec<ConnectionProfile>,
    pub credentials: Option<HashMap<String, Credentials>>,
    pub checksum: String,
}
```

## Data Models

### Enhanced Connection Profile
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionProfile {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub folder: Option<String>,
    pub config: AdvancedConnectionConfig,
    pub metadata: ConnectionMetadata,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_used: Option<DateTime<Utc>>,
    pub use_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionMetadata {
    pub color: Option<String>,
    pub icon: Option<String>,
    pub is_favorite: bool,
    pub auto_connect: bool,
    pub environment: Environment,
    pub monitoring_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Environment {
    Development,
    Staging,
    Production,
    Testing,
    Other(String),
}
```

### Advanced Connection Configuration
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdvancedConnectionConfig {
    // Basic connection info
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    
    // Advanced settings
    pub connection_timeout: Duration,
    pub query_timeout: Duration,
    pub max_connections: u32,
    pub idle_timeout: Duration,
    pub retry_attempts: u32,
    pub retry_delay: Duration,
    
    // SSL Configuration
    pub ssl_config: SSLConfig,
    
    // Custom parameters
    pub custom_parameters: HashMap<String, String>,
    
    // Connection string template
    pub connection_string_template: Option<String>,
}
```

## Error Handling

### Enhanced Error Types
```rust
#[derive(Debug, thiserror::Error)]
pub enum ConnectionManagerError {
    #[error("Profile not found: {0}")]
    ProfileNotFound(String),
    
    #[error("Invalid profile configuration: {0}")]
    InvalidConfiguration(String),
    
    #[error("Credential storage error: {0}")]
    CredentialError(String),
    
    #[error("Health check failed: {0}")]
    HealthCheckFailed(String),
    
    #[error("Import/Export error: {0}")]
    ImportExportError(String),
    
    #[error("Pool management error: {0}")]
    PoolError(String),
    
    #[error("Validation error: {0}")]
    ValidationError(String),
}
```

## Security Considerations

### Enhanced Security Model
- **Credential Encryption**: Todas las credenciales se almacenan encriptadas usando AES-256-GCM
- **Keyring Integration**: Uso del keyring del sistema operativo como capa adicional de seguridad
- **Export Security**: Las exportaciones pueden incluir o excluir credenciales según la configuración
- **Audit Trail**: Registro de todas las operaciones de gestión de credenciales
- **Session Management**: Tokens de sesión para acceso a credenciales con expiración automática

### Credential Isolation
```rust
pub struct SecureCredentialManager {
    master_key: [u8; 32],
    keyring: Keyring,
    audit_log: AuditLogger,
}

impl SecureCredentialManager {
    pub async fn encrypt_credentials(&self, credentials: &Credentials) -> Result<EncryptedCredentials, SecurityError>;
    pub async fn decrypt_credentials(&self, encrypted: &EncryptedCredentials) -> Result<Credentials, SecurityError>;
    pub async fn rotate_encryption_key(&mut self) -> Result<(), SecurityError>;
    pub async fn audit_access(&self, profile_id: &str, operation: AuditOperation) -> Result<(), SecurityError>;
}
```

## Testing Strategy

### Unit Tests
- **ConnectionProfileStore**: CRUD operations, búsqueda, validación
- **CredentialVault**: Encriptación, almacenamiento seguro, rotación de claves
- **HealthCheckService**: Monitoreo, alertas, estadísticas de uptime
- **ImportExportService**: Validación de datos, estrategias de merge, integridad

### Integration Tests
- **End-to-End Profile Management**: Creación, uso y eliminación de perfiles completos
- **Security Testing**: Verificación de encriptación y protección de credenciales
- **Performance Testing**: Pruebas con grandes cantidades de perfiles y conexiones concurrentes
- **Cross-Platform Testing**: Verificación de keyring en diferentes sistemas operativos

### Frontend Tests
- **Component Testing**: Todos los componentes de gestión de conexiones
- **User Flow Testing**: Flujos completos de creación y uso de perfiles
- **Accessibility Testing**: Navegación por teclado y compatibilidad con screen readers

## Performance Considerations

### Connection Pool Optimization
- **Lazy Loading**: Los pools se crean solo cuando se necesitan
- **Connection Reuse**: Reutilización inteligente de conexiones existentes
- **Memory Management**: Limpieza automática de pools inactivos
- **Concurrent Access**: Manejo thread-safe de múltiples conexiones simultáneas

### Data Storage Optimization
- **Indexing**: Índices para búsqueda rápida de perfiles
- **Caching**: Cache en memoria para perfiles frecuentemente usados
- **Batch Operations**: Operaciones por lotes para importación/exportación
- **Compression**: Compresión de datos de exportación para archivos grandes

## Monitoring and Observability

### Health Monitoring
```rust
pub struct ConnectionMonitor {
    metrics_collector: MetricsCollector,
    alert_manager: AlertManager,
    dashboard_data: DashboardData,
}

impl ConnectionMonitor {
    pub async fn collect_metrics(&self) -> Result<ConnectionMetrics, MonitorError>;
    pub async fn generate_health_report(&self) -> Result<HealthReport, MonitorError>;
    pub async fn trigger_alerts(&self, conditions: AlertConditions) -> Result<(), MonitorError>;
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectionMetrics {
    pub total_profiles: u32,
    pub active_connections: u32,
    pub average_response_time: f64,
    pub success_rate: f64,
    pub uptime_percentage: f64,
}
```

## Future Extensibility

### Plugin Architecture
- **Connection Providers**: Soporte para otros tipos de bases de datos
- **Authentication Methods**: OAuth, LDAP, certificados
- **Monitoring Extensions**: Métricas personalizadas, integraciones con sistemas de monitoreo
- **Export Formats**: Soporte para formatos adicionales de importación/exportación

### Planned Enhancements
1. **Team Collaboration**: Compartir perfiles de conexión entre equipos
2. **Environment Management**: Gestión automática de conexiones por entorno
3. **Connection Templates**: Plantillas predefinidas para configuraciones comunes
4. **Advanced Analytics**: Análisis de patrones de uso y optimización automática