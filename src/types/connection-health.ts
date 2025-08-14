import { ConnectionProfile, AdvancedConnectionConfig } from './connection-profile';

export interface ConnectionTestResult {
  success: boolean;
  response_time_ms?: number;
  error_message?: string;
  error_code?: string;
  server_version?: string;
  database_name?: string;
  connection_details?: ConnectionDetails;
  troubleshooting_hints: string[];
}

export interface ConnectionDetails {
  host: string;
  port: number;
  database: string;
  username: string;
  ssl_used: boolean;
  server_encoding?: string;
  client_encoding?: string;
}

export interface ConnectionTestOptions {
  timeout_seconds?: number;
  retry_attempts?: number;
  retry_delay_ms?: number;
  validate_ssl: boolean;
  check_permissions: boolean;
  test_query?: string;
}

export interface ConnectionValidationError {
  InvalidHost?: string;
  InvalidPort?: string;
  InvalidDatabase?: string;
  InvalidUsername?: string;
  InvalidSSLConfig?: string;
  InvalidTimeout?: string;
  InvalidCustomParameter?: [string, string];
}

export interface ConnectionHealth {
  status: HealthStatus;
  last_checked: string; // ISO date string
  response_time_ms?: number;
  error_message?: string;
}

export interface HealthCheckResult {
  timestamp: string; // ISO date string
  status: HealthStatus;
  response_time_ms?: number;
  error_message?: string;
}

export interface ConnectionHealthHistory {
  current: ConnectionHealth;
  history: HealthCheckResult[];
  uptime_percentage: number;
}

export interface MonitoringConfig {
  enable_auto_check: boolean;
  check_interval_minutes: number;
  enable_notifications: boolean;
  critical_connection_ids: string[];
}

export interface PoolStats {
  active_connections: number;
  idle_connections: number;
  max_connections: number;
  total_connections_created: number;
  average_wait_time_ms: number;
}

export interface ConnectionMetrics {
  total_profiles: number;
  active_connections: number;
  average_response_time_ms: number;
  success_rate: number;
  uptime_percentage: number;
}

export type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown';

// Default values for connection test options
export const DEFAULT_CONNECTION_TEST_OPTIONS: ConnectionTestOptions = {
  timeout_seconds: 30,
  retry_attempts: 3,
  retry_delay_ms: 1000,
  validate_ssl: true,
  check_permissions: false,
  test_query: 'SELECT 1',
};

// Helper functions for working with health data
export const getHealthStatusColor = (status: HealthStatus): string => {
  switch (status) {
    case 'healthy':
      return 'text-green-600 dark:text-green-400';
    case 'warning':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'error':
      return 'text-red-600 dark:text-red-400';
    case 'unknown':
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

export const getHealthStatusIcon = (status: HealthStatus): string => {
  switch (status) {
    case 'healthy':
      return '✅';
    case 'warning':
      return '⚠️';
    case 'error':
      return '❌';
    case 'unknown':
    default:
      return '❓';
  }
};

export const formatResponseTime = (responseTimeMs?: number): string => {
  if (!responseTimeMs) return 'N/A';
  
  if (responseTimeMs < 1000) {
    return `${responseTimeMs}ms`;
  } else {
    return `${(responseTimeMs / 1000).toFixed(2)}s`;
  }
};

export const formatUptime = (uptimePercentage: number): string => {
  return `${uptimePercentage.toFixed(2)}%`;
};

export const isHealthy = (status: HealthStatus): boolean => {
  return status === 'healthy';
};

export const isUnhealthy = (status: HealthStatus): boolean => {
  return status === 'error';
};

export const needsAttention = (status: HealthStatus): boolean => {
  return status === 'warning' || status === 'error';
};

// Validation error helpers
export const getValidationErrorMessage = (error: ConnectionValidationError): string => {
  if (error.InvalidHost) return `Invalid host: ${error.InvalidHost}`;
  if (error.InvalidPort) return `Invalid port: ${error.InvalidPort}`;
  if (error.InvalidDatabase) return `Invalid database: ${error.InvalidDatabase}`;
  if (error.InvalidUsername) return `Invalid username: ${error.InvalidUsername}`;
  if (error.InvalidSSLConfig) return `Invalid SSL config: ${error.InvalidSSLConfig}`;
  if (error.InvalidTimeout) return `Invalid timeout: ${error.InvalidTimeout}`;
  if (error.InvalidCustomParameter) {
    const [key, message] = error.InvalidCustomParameter;
    return `Invalid custom parameter '${key}': ${message}`;
  }
  return 'Unknown validation error';
};

export const getValidationErrorType = (error: ConnectionValidationError): string => {
  if (error.InvalidHost) return 'host';
  if (error.InvalidPort) return 'port';
  if (error.InvalidDatabase) return 'database';
  if (error.InvalidUsername) return 'username';
  if (error.InvalidSSLConfig) return 'ssl';
  if (error.InvalidTimeout) return 'timeout';
  if (error.InvalidCustomParameter) return 'custom_parameter';
  return 'unknown';
};

// Connection test result helpers
export const isConnectionSuccessful = (result: ConnectionTestResult): boolean => {
  return result.success;
};

export const hasConnectionError = (result: ConnectionTestResult): boolean => {
  return !result.success && !!result.error_message;
};

export const getConnectionErrorSeverity = (errorCode?: string): 'low' | 'medium' | 'high' => {
  if (!errorCode) return 'medium';
  
  const highSeverityErrors = ['AUTHENTICATION_FAILED', 'DATABASE_NOT_FOUND', 'HOST_RESOLUTION_ERROR'];
  const lowSeverityErrors = ['CONNECTION_TIMEOUT', 'SSL_ERROR'];
  
  if (highSeverityErrors.includes(errorCode)) return 'high';
  if (lowSeverityErrors.includes(errorCode)) return 'low';
  return 'medium';
};

export const shouldRetryConnection = (errorCode?: string): boolean => {
  if (!errorCode) return false;
  
  const retryableErrors = ['CONNECTION_TIMEOUT', 'CONNECTION_REFUSED'];
  return retryableErrors.includes(errorCode);
};

export const getConnectionTestSummary = (result: ConnectionTestResult): string => {
  if (result.success) {
    const responseTime = result.response_time_ms ? ` (${formatResponseTime(result.response_time_ms)})` : '';
    return `Connection successful${responseTime}`;
  } else {
    return result.error_message || 'Connection failed';
  }
};