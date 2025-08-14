// Re-export connection profile types from database.ts for better organization
export type {
  ConnectionProfile,
  AdvancedConnectionConfig,
  SSLConfig,
  ConnectionMetadata,
  ConnectionHealth,
  HealthCheckResult,
  ConnectionHealthHistory,
  MonitoringConfig,
  PoolStats,
  ConnectionMetrics,
  ExportData,
  EncryptedCredentials,
  ImportResult,
  ValidationResult,
  StorageStats,
  ProfileSearchFilters,
  ProfileSortOptions,
  ConnectionProfileManagerProps,
  QuickSelectorProps,
  HealthMonitorProps,
  ImportExportProps,
  AdvancedConfigProps,
  CreateConnectionProfileRequest,
  UpdateConnectionProfileRequest,
} from './database';

export {
  Environment,
  HealthStatus,
  MergeStrategy,
  DEFAULT_ADVANCED_CONFIG,
  DEFAULT_METADATA,
  DEFAULT_MONITORING_CONFIG,
} from './database';

// Import types for local use
import type {
  ConnectionProfile,
  ConnectionHealth,
  CreateConnectionProfileRequest,
} from './database';
import { Environment, HealthStatus } from './database';

// Additional utility types specific to connection profile management

export interface ConnectionProfileFormData {
  name: string;
  description: string;
  tags: string;
  folder: string;
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
  connectionTimeout: string;
  queryTimeout: string;
  maxConnections: string;
  idleTimeout: string;
  retryAttempts: string;
  retryDelay: string;
  sslMode: string;
  sslCert: string;
  sslKey: string;
  sslCa: string;
  customParameters: string;
  connectionStringTemplate: string;
  color: string;
  icon: string;
  isFavorite: boolean;
  autoConnect: boolean;
  environment: string;
  monitoringEnabled: boolean;
}

export interface ConnectionProfileValidation {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export interface ConnectionTestResult {
  success: boolean;
  responseTimeMs?: number;
  errorMessage?: string;
  serverVersion?: string;
  databaseName?: string;
}

// ProfileSearchFilters and ProfileSortOptions are now imported from database.ts

export interface ConnectionProfileListItem {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  folder?: string;
  host: string;
  database: string;
  environment: Environment;
  isFavorite: boolean;
  lastUsed?: Date;
  useCount: number;
  health?: ConnectionHealth;
}

// Form validation schemas (for use with form libraries like react-hook-form)
export interface ConnectionProfileFormSchema {
  name: {
    required: boolean;
    minLength: number;
    maxLength: number;
  };
  host: {
    required: boolean;
    pattern: RegExp;
  };
  port: {
    required: boolean;
    min: number;
    max: number;
  };
  database: {
    required: boolean;
    minLength: number;
  };
  username: {
    required: boolean;
    minLength: number;
  };
  password: {
    required: boolean;
    minLength: number;
  };
}

export const CONNECTION_PROFILE_FORM_SCHEMA: ConnectionProfileFormSchema = {
  name: {
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  host: {
    required: true,
    pattern: /^[a-zA-Z0-9.-]+$/,
  },
  port: {
    required: true,
    min: 1,
    max: 65535,
  },
  database: {
    required: true,
    minLength: 1,
  },
  username: {
    required: true,
    minLength: 1,
  },
  password: {
    required: true,
    minLength: 1,
  },
};

// Constants for UI components
export const ENVIRONMENT_COLORS: Record<Environment, string> = {
  [Environment.Development]: 'bg-green-100 text-green-800 border-green-200',
  [Environment.Staging]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  [Environment.Production]: 'bg-red-100 text-red-800 border-red-200',
  [Environment.Testing]: 'bg-blue-100 text-blue-800 border-blue-200',
  [Environment.Other]: 'bg-gray-100 text-gray-800 border-gray-200',
};

export const HEALTH_STATUS_COLORS: Record<HealthStatus, string> = {
  [HealthStatus.Healthy]: 'text-green-600',
  [HealthStatus.Warning]: 'text-yellow-600',
  [HealthStatus.Error]: 'text-red-600',
  [HealthStatus.Unknown]: 'text-gray-600',
};

export const HEALTH_STATUS_ICONS: Record<HealthStatus, string> = {
  [HealthStatus.Healthy]: '●',
  [HealthStatus.Warning]: '⚠',
  [HealthStatus.Error]: '●',
  [HealthStatus.Unknown]: '○',
};

// Utility functions for type conversion
export function formDataToConnectionProfile(
  formData: ConnectionProfileFormData
): CreateConnectionProfileRequest {
  return {
    name: formData.name,
    description: formData.description || undefined,
    tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : [],
    folder: formData.folder || undefined,
    config: {
      host: formData.host,
      port: parseInt(formData.port, 10),
      database: formData.database,
      username: formData.username,
      connectionTimeout: parseInt(formData.connectionTimeout, 10),
      queryTimeout: parseInt(formData.queryTimeout, 10),
      maxConnections: parseInt(formData.maxConnections, 10),
      idleTimeout: parseInt(formData.idleTimeout, 10),
      retryAttempts: parseInt(formData.retryAttempts, 10),
      retryDelay: parseInt(formData.retryDelay, 10),
      sslConfig: {
        mode: formData.sslMode as any,
        cert: formData.sslCert || undefined,
        key: formData.sslKey || undefined,
        ca: formData.sslCa || undefined,
      },
      customParameters: formData.customParameters 
        ? JSON.parse(formData.customParameters) 
        : {},
      connectionStringTemplate: formData.connectionStringTemplate || undefined,
    },
    metadata: {
      color: formData.color || undefined,
      icon: formData.icon || undefined,
      isFavorite: formData.isFavorite,
      autoConnect: formData.autoConnect,
      environment: formData.environment as Environment,
      monitoringEnabled: formData.monitoringEnabled,
    },
  };
}

export function connectionProfileToFormData(
  profile: ConnectionProfile
): ConnectionProfileFormData {
  return {
    name: profile.name,
    description: profile.description || '',
    tags: profile.tags.join(', '),
    folder: profile.folder || '',
    host: profile.config.host,
    port: profile.config.port.toString(),
    database: profile.config.database,
    username: profile.config.username,
    password: '', // Never populate password in form
    connectionTimeout: profile.config.connectionTimeout.toString(),
    queryTimeout: profile.config.queryTimeout.toString(),
    maxConnections: profile.config.maxConnections.toString(),
    idleTimeout: profile.config.idleTimeout.toString(),
    retryAttempts: profile.config.retryAttempts.toString(),
    retryDelay: profile.config.retryDelay.toString(),
    sslMode: profile.config.sslConfig.mode,
    sslCert: profile.config.sslConfig.cert || '',
    sslKey: profile.config.sslConfig.key || '',
    sslCa: profile.config.sslConfig.ca || '',
    customParameters: JSON.stringify(profile.config.customParameters, null, 2),
    connectionStringTemplate: profile.config.connectionStringTemplate || '',
    color: profile.metadata.color || '',
    icon: profile.metadata.icon || '',
    isFavorite: profile.metadata.isFavorite,
    autoConnect: profile.metadata.autoConnect,
    environment: profile.metadata.environment,
    monitoringEnabled: profile.metadata.monitoringEnabled,
  };
}

export function validateConnectionProfile(
  formData: ConnectionProfileFormData
): ConnectionProfileValidation {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  // Required field validation
  if (!formData.name.trim()) {
    errors.name = 'Connection name is required';
  }
  if (!formData.host.trim()) {
    errors.host = 'Host is required';
  }
  if (!formData.database.trim()) {
    errors.database = 'Database name is required';
  }
  if (!formData.username.trim()) {
    errors.username = 'Username is required';
  }
  if (!formData.password.trim()) {
    errors.password = 'Password is required';
  }

  // Port validation
  const port = parseInt(formData.port, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.port = 'Port must be a number between 1 and 65535';
  }

  // Timeout validation
  const connectionTimeout = parseInt(formData.connectionTimeout, 10);
  if (isNaN(connectionTimeout) || connectionTimeout < 1) {
    errors.connectionTimeout = 'Connection timeout must be a positive number';
  }

  const queryTimeout = parseInt(formData.queryTimeout, 10);
  if (isNaN(queryTimeout) || queryTimeout < 1) {
    errors.queryTimeout = 'Query timeout must be a positive number';
  }

  // Connection pool validation
  const maxConnections = parseInt(formData.maxConnections, 10);
  if (isNaN(maxConnections) || maxConnections < 1) {
    errors.maxConnections = 'Max connections must be a positive number';
  }

  // Custom parameters validation
  if (formData.customParameters.trim()) {
    try {
      JSON.parse(formData.customParameters);
    } catch {
      errors.customParameters = 'Custom parameters must be valid JSON';
    }
  }

  // Warnings
  if (formData.environment === Environment.Production && !formData.sslMode.includes('require')) {
    warnings.sslMode = 'Consider using SSL for production connections';
  }

  if (maxConnections > 50) {
    warnings.maxConnections = 'High connection pool size may impact performance';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings,
  };
}