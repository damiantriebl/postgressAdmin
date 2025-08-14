import type { 
  ConnectionProfile, 
  AdvancedConnectionConfig,
  ConnectionMetadata,
  ValidationResult 
} from '@/types/connection-profile';
import { Environment } from '@/types/connection-profile';

/**
 * Validates a connection profile object for completeness and correctness
 */
export function validateConnectionProfile(profile: ConnectionProfile): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!profile.id || profile.id.trim() === '') {
    errors.push('Profile ID is required');
  }

  if (!profile.name || profile.name.trim() === '') {
    errors.push('Profile name is required');
  }

  // Config validation
  if (!profile.config) {
    errors.push('Connection configuration is required');
  } else {
    const configErrors = validateAdvancedConnectionConfig(profile.config);
    errors.push(...configErrors.errors);
    warnings.push(...configErrors.warnings);
  }

  // Metadata validation
  if (!profile.metadata) {
    errors.push('Connection metadata is required');
  } else {
    const metadataErrors = validateConnectionMetadata(profile.metadata);
    errors.push(...metadataErrors.errors);
    warnings.push(...metadataErrors.warnings);
  }

  // Date validation
  if (!profile.createdAt) {
    errors.push('Created date is required');
  }

  if (!profile.updatedAt) {
    errors.push('Updated date is required');
  }

  if (profile.createdAt && profile.updatedAt && profile.createdAt > profile.updatedAt) {
    warnings.push('Created date is after updated date');
  }

  return {
    isValid: errors.length === 0,
    versionCompatible: true, // For now, assume all versions are compatible
    profileCount: 1,
    errors,
    warnings,
  };
}

/**
 * Validates advanced connection configuration
 */
export function validateAdvancedConnectionConfig(config: AdvancedConnectionConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!config.host || config.host.trim() === '') {
    errors.push('Host is required');
  }

  if (!config.database || config.database.trim() === '') {
    errors.push('Database name is required');
  }

  if (!config.username || config.username.trim() === '') {
    errors.push('Username is required');
  }

  // Port validation
  if (config.port < 1 || config.port > 65535) {
    errors.push('Port must be between 1 and 65535');
  }

  // Timeout validation
  if (config.connectionTimeout < 1) {
    errors.push('Connection timeout must be positive');
  }

  if (config.queryTimeout < 1) {
    errors.push('Query timeout must be positive');
  }

  if (config.idleTimeout < 1) {
    errors.push('Idle timeout must be positive');
  }

  if (config.retryDelay < 0) {
    errors.push('Retry delay cannot be negative');
  }

  // Pool validation
  if (config.maxConnections < 1) {
    errors.push('Max connections must be at least 1');
  }

  if (config.retryAttempts < 0) {
    errors.push('Retry attempts cannot be negative');
  }

  // Warnings
  if (config.connectionTimeout > 300) {
    warnings.push('Connection timeout is very high (>5 minutes)');
  }

  if (config.maxConnections > 100) {
    warnings.push('Max connections is very high (>100)');
  }

  if (config.retryAttempts > 10) {
    warnings.push('Retry attempts is very high (>10)');
  }

  return {
    isValid: errors.length === 0,
    versionCompatible: true,
    profileCount: 1,
    errors,
    warnings,
  };
}

/**
 * Validates connection metadata
 */
export function validateConnectionMetadata(metadata: ConnectionMetadata): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Environment validation
  const validEnvironments = Object.values(Environment);
  if (!validEnvironments.includes(metadata.environment)) {
    errors.push(`Invalid environment: ${metadata.environment}`);
  }

  // Color validation (if provided)
  if (metadata.color && !isValidColor(metadata.color)) {
    warnings.push('Color format may not be valid');
  }

  return {
    isValid: errors.length === 0,
    versionCompatible: true,
    profileCount: 1,
    errors,
    warnings,
  };
}

/**
 * Basic color validation (hex colors, CSS color names, etc.)
 */
function isValidColor(color: string): boolean {
  // Check for hex colors
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
    return true;
  }

  // Check for CSS color names (basic set)
  const cssColors = [
    'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown',
    'black', 'white', 'gray', 'grey', 'cyan', 'magenta', 'lime', 'navy',
    'teal', 'silver', 'maroon', 'olive', 'aqua', 'fuchsia'
  ];

  return cssColors.includes(color.toLowerCase());
}

/**
 * Validates that a profile can be serialized and deserialized correctly
 */
export function validateSerialization(profile: ConnectionProfile): { success: boolean; error?: string } {
  try {
    // Test JSON serialization
    const serialized = JSON.stringify(profile);
    const deserialized = JSON.parse(serialized) as ConnectionProfile;

    // Basic checks
    if (deserialized.id !== profile.id) {
      return { success: false, error: 'ID mismatch after serialization' };
    }

    if (deserialized.name !== profile.name) {
      return { success: false, error: 'Name mismatch after serialization' };
    }

    if (deserialized.config.host !== profile.config.host) {
      return { success: false, error: 'Host mismatch after serialization' };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: `Serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Creates a sample connection profile for testing
 */
export function createSampleProfile(): ConnectionProfile {
  const now = new Date();
  
  return {
    id: 'sample-profile-id',
    name: 'Sample PostgreSQL Connection',
    description: 'A sample connection profile for testing',
    tags: ['development', 'testing'],
    folder: 'samples',
    config: {
      host: 'localhost',
      port: 5432,
      database: 'sampledb',
      username: 'sampleuser',
      connectionTimeout: 30,
      queryTimeout: 300,
      maxConnections: 10,
      idleTimeout: 300,
      retryAttempts: 3,
      retryDelay: 1,
      sslConfig: {
        mode: 'prefer' as any,
      },
      customParameters: {},
    },
    metadata: {
      isFavorite: false,
      autoConnect: false,
      environment: Environment.Development,
      monitoringEnabled: false,
    },
    createdAt: now,
    updatedAt: now,
    lastUsed: undefined,
    useCount: 0,
  };
}