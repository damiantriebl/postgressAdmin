export interface ConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl_mode: SslMode;
  connection_timeout: number;
}

export enum SslMode {
  Disable = "Disable",
  Allow = "Allow",
  Prefer = "Prefer",
  Require = "Require",
  VerifyCa = "VerifyCa",
  VerifyFull = "VerifyFull",
}

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error?: string;
}

export interface ConnectionStatus {
  is_connected: boolean;
  connection_string?: string;
  database_name?: string;
  server_version?: string;
}

export interface QueryResult {
  columns: string[];
  rows: any[][];
  row_count: number;
  execution_time_ms: number;
  rows_affected?: number;
  query_type?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  current_page: number;
  page_size: number;
  total_rows?: number;
  has_more: boolean;
}

export interface QueryValidationResponse {
  is_valid: boolean;
  warnings: string[];
  query_type: string;
  is_destructive: boolean;
  risk_level: string;
}

export interface QueryWarning {
  level: WarningLevel;
  message: string;
  suggestion: string;
}

export enum WarningLevel {
  Low = "Low",
  Medium = "Medium",
  High = "High",
}

export enum RiskLevel {
  Low = "Low",
  Medium = "Medium",
  High = "High",
}

export enum QueryType {
  Select = "Select",
  Insert = "Insert",
  Update = "Update",
  Delete = "Delete",
  DDL = "DDL",
  Other = "Other",
}

export interface ColumnInfo {
  name: string;
  data_type: string;
  is_nullable: boolean;
  default_value?: string;
  is_primary_key?: boolean;
  is_foreign_key?: boolean;
}

export interface DetailedColumnInfo {
  name: string;
  data_type: string;
  udt_name: string; // User-defined type name (for enums, custom types)
  is_nullable: boolean;
  default_value?: string;
  character_maximum_length?: number;
  numeric_precision?: number;
  numeric_scale?: number;
  is_primary_key: boolean;
  is_foreign_key: boolean;
}

export interface EditableCell {
  rowIndex: number;
  columnIndex: number;
  columnName: string;
  originalValue: any;
  currentValue: any;
  dataType: string;
  isNullable: boolean;
  isEditing: boolean;
  hasChanges: boolean;
}

export interface RowEditState {
  rowIndex: number;
  isEditing: boolean;
  hasChanges: boolean;
  originalData: any[];
  currentData: any[];
  changedColumns: Set<string>;
}

export interface TableInfo {
  name: string;
  schema: string;
  row_count?: number;
}

export interface IndexInfo {
  name: string;
  table_name: string;
  schema_name: string;
  columns: string[];
  is_unique: boolean;
  is_primary: boolean;
  index_type: string;
  definition: string;
  size_bytes?: number;
}

export interface ViewInfo {
  name: string;
  schema: string;
  definition: string;
  is_updatable: boolean;
  check_option?: string;
}

export interface StoredProcedureInfo {
  name: string;
  schema: string;
  language: string;
  return_type?: string;
  argument_types: string[];
  definition: string;
  is_security_definer: boolean;
}

export interface MaterializedViewInfo {
  name: string;
  schema: string;
  definition: string;
  is_populated: boolean;
  size_bytes?: number;
  row_count?: number;
}

export interface CreateIndexOptions {
  name: string;
  table_name: string;
  schema_name?: string;
  columns: string[];
  is_unique: boolean;
  index_type?: string; // btree, hash, gin, gist, etc.
  where_clause?: string; // for partial indexes
}

export interface ForeignKeyInfo {
  name: string;
  table_name: string;
  column_name: string;
  referenced_table: string;
  referenced_column: string;
}

export interface TableSizeInfo {
  total_size: string;
  total_size_bytes: number;
  table_size: string;
  table_size_bytes: number;
  index_size: string;
  index_size_bytes: number;
}

export interface TableStatistics {
  table_name: string;
  estimated_rows: number;
  pages: number;
  total_size: number;
  table_size: number;
  index_size: number;
  avg_row_size: number;
  column_statistics: ColumnStatistics[];
}

export interface ColumnStatistics {
  column_name: string;
  n_distinct?: number;
  most_common_vals?: string[];
  most_common_freqs?: number[];
  correlation?: number;
}

export interface DatabaseStatistics {
  database_size: number;
  table_count: number;
  index_count: number;
  schema_count: number;
}

export interface ExportOptions {
  format: ExportFormat;
  include_headers: boolean;
  pretty_json: boolean;
  filename?: string;
  sql_type?: SqlExportType;
  table_name?: string;
  schema_name?: string;
}

export enum SqlExportType {
  INSERT = "INSERT",
  SEED = "SEED",
  FULL_BACKUP = "FULL_BACKUP",
}

export interface ImportOptions {
  format: ExportFormat;
  table_name?: string;
  schema_name?: string;
  truncate_before_import?: boolean;
  create_table_if_not_exists?: boolean;
}

export interface ImportResult {
  success: boolean;
  rows_imported: number;
  errors: string[];
  warnings: string[];
  execution_time_ms: number;
}

export enum ExportFormat {
  CSV = "CSV",
  JSON = "JSON",
  SQL = "SQL",
}

export interface ExportResult {
  content: string;
  filename: string;
  size_bytes: number;
  row_count: number;
  format: ExportFormat;
}

export interface ExportPreview {
  filename: string;
  format: string;
  size_estimate: string;
  row_count: number;
  column_count: number;
  preview_content: string;
}

export interface QueryHistoryItem {
  query: string;
  timestamp: Date;
  success: boolean;
  executionTime?: number;
}

export interface FilterCondition {
  column: string;
  operator: string;
  value: string;
}

// Connection Profile Management Types

export interface ConnectionProfile {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  folder?: string;
  config: AdvancedConnectionConfig;
  metadata: ConnectionMetadata;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  useCount: number;
}

export interface AdvancedConnectionConfig {
  // Basic connection info
  host: string;
  port: number;
  database: string;
  username: string;
  
  // Advanced settings (in seconds)
  connectionTimeout: number;
  queryTimeout: number;
  maxConnections: number;
  idleTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  
  // SSL Configuration
  sslConfig: SSLConfig;
  
  // Custom parameters
  customParameters: Record<string, string>;
  
  // Connection string template
  connectionStringTemplate?: string;
}

export interface SSLConfig {
  mode: SslMode;
  cert?: string;
  key?: string;
  ca?: string;
}

export interface ConnectionMetadata {
  color?: string;
  icon?: string;
  isFavorite: boolean;
  autoConnect: boolean;
  environment: Environment;
  monitoringEnabled: boolean;
}

export enum Environment {
  Development = "development",
  Staging = "staging",
  Production = "production",
  Testing = "testing",
  Other = "other",
}

export interface ConnectionHealth {
  status: HealthStatus;
  lastChecked: Date;
  responseTimeMs?: number;
  errorMessage?: string;
}

export enum HealthStatus {
  Healthy = "healthy",
  Warning = "warning",
  Error = "error",
  Unknown = "unknown",
}

export interface HealthCheckResult {
  timestamp: Date;
  status: HealthStatus;
  responseTimeMs?: number;
  errorMessage?: string;
}

export interface ConnectionHealthHistory {
  current: ConnectionHealth;
  history: HealthCheckResult[];
  uptimePercentage: number;
}

export interface MonitoringConfig {
  enableAutoCheck: boolean;
  checkIntervalMinutes: number;
  enableNotifications: boolean;
  criticalConnectionIds: string[];
}

export interface PoolStats {
  activeConnections: number;
  idleConnections: number;
  maxConnections: number;
  totalConnectionsCreated: number;
  averageWaitTimeMs: number;
}

export interface ConnectionMetrics {
  totalProfiles: number;
  activeConnections: number;
  averageResponseTimeMs: number;
  successRate: number;
  uptimePercentage: number;
}

export enum MergeStrategy {
  Replace = "replace",
  Merge = "merge",
  Skip = "skip",
}

export interface ExportData {
  version: string;
  exportedAt: Date;
  profiles: ConnectionProfile[];
  credentials?: Record<string, EncryptedCredentials>;
  checksum: string;
}

export interface EncryptedCredentials {
  encryptedPassword: number[];
  nonce: number[];
  encryptedAt: Date;
}

export interface ImportResult {
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
  warnings: string[];
}

export interface ValidationResult {
  isValid: boolean;
  versionCompatible: boolean;
  profileCount: number;
  errors: string[];
  warnings: string[];
}

export interface StorageStats {
  totalProfiles: number;
  favoriteCount: number;
  profilesWithUsage: number;
  environments: Record<string, number>;
  tags: Record<string, number>;
  storageVersion: string;
  createdAt: Date;
  lastUpdated: Date;
}

export interface ProfileSearchFilters {
  query?: string;
  tags?: string[];
  folder?: string;
  environment?: Environment;
  isFavorite?: boolean;
  limit?: number;
  offset?: number;
}

export interface ProfileSortOptions {
  field: 'name' | 'createdAt' | 'updatedAt' | 'lastUsed' | 'useCount';
  direction: 'asc' | 'desc';
}

// Component Props Interfaces

export interface ConnectionProfileManagerProps {
  profiles: ConnectionProfile[];
  onCreateProfile: (profile: Omit<ConnectionProfile, 'id' | 'createdAt' | 'updatedAt' | 'useCount'>) => void;
  onUpdateProfile: (id: string, updates: Partial<ConnectionProfile>) => void;
  onDeleteProfile: (id: string) => void;
  onConnectToProfile: (id: string) => void;
}

export interface QuickSelectorProps {
  recentConnections: ConnectionProfile[];
  favoriteConnections: ConnectionProfile[];
  healthStatus: Map<string, ConnectionHealth>;
  onQuickConnect: (profileId: string) => void;
  onOpenProfileManager: () => void;
}

export interface HealthMonitorProps {
  connections: ConnectionProfile[];
  healthData: Map<string, ConnectionHealthHistory>;
  monitoringConfig: MonitoringConfig;
  onUpdateMonitoringConfig: (config: MonitoringConfig) => void;
  onManualHealthCheck: (profileId: string) => void;
}

export interface ImportExportProps {
  onExportProfiles: (profileIds: string[], includeCredentials: boolean) => void;
  onImportProfiles: (file: File, mergeStrategy: MergeStrategy) => void;
  onCreateBackup: () => void;
  onRestoreBackup: (file: File) => void;
}

export interface AdvancedConfigProps {
  profile: ConnectionProfile;
  onUpdateConfig: (config: AdvancedConnectionConfig) => void;
  onTestConnection: () => void;
  onResetToDefaults: () => void;
}

// Utility Types

export interface CreateConnectionProfileRequest {
  name: string;
  description?: string;
  tags?: string[];
  folder?: string;
  config: AdvancedConnectionConfig;
  metadata?: Partial<ConnectionMetadata>;
}

export interface UpdateConnectionProfileRequest {
  name?: string;
  description?: string;
  tags?: string[];
  folder?: string;
  config?: Partial<AdvancedConnectionConfig>;
  metadata?: Partial<ConnectionMetadata>;
}

// Default values for new profiles
export const DEFAULT_ADVANCED_CONFIG: AdvancedConnectionConfig = {
  host: "localhost",
  port: 5432,
  database: "postgres",
  username: "postgres",
  connectionTimeout: 30,
  queryTimeout: 300,
  maxConnections: 10,
  idleTimeout: 300,
  retryAttempts: 3,
  retryDelay: 1,
  sslConfig: {
    mode: SslMode.Prefer,
  },
  customParameters: {},
};

export const DEFAULT_METADATA: ConnectionMetadata = {
  isFavorite: false,
  autoConnect: false,
  environment: Environment.Development,
  monitoringEnabled: false,
};

export const DEFAULT_MONITORING_CONFIG: MonitoringConfig = {
  enableAutoCheck: false,
  checkIntervalMinutes: 5,
  enableNotifications: true,
  criticalConnectionIds: [],
};