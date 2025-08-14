import { invoke } from '@tauri-apps/api/core';
import {
  ConnectionTestResult,
  ConnectionTestOptions,
  ConnectionValidationError,
  ConnectionHealth,
  HealthCheckResult,
  DEFAULT_CONNECTION_TEST_OPTIONS,
} from '../types/connection-health';
import { ConnectionProfile, AdvancedConnectionConfig } from '../types/connection-profile';

export class ConnectionHealthService {
  /**
   * Test a connection configuration with password
   */
  static async testConnectionConfig(
    config: AdvancedConnectionConfig,
    password: string,
    options?: ConnectionTestOptions
  ): Promise<ConnectionTestResult> {
    try {
      return await invoke('test_connection_config', {
        config,
        password,
        options: options || DEFAULT_CONNECTION_TEST_OPTIONS,
      });
    } catch (error) {
      console.error('Failed to test connection config:', error);
      throw error;
    }
  }

  /**
   * Test a connection profile (retrieves password from credential vault)
   */
  static async testConnectionProfile(
    profile: ConnectionProfile,
    options?: ConnectionTestOptions
  ): Promise<ConnectionTestResult> {
    try {
      return await invoke('test_connection_profile', {
        profile,
        options: options || DEFAULT_CONNECTION_TEST_OPTIONS,
      });
    } catch (error) {
      console.error('Failed to test connection profile:', error);
      throw error;
    }
  }

  /**
   * Test connection by profile ID
   */
  static async testConnectionByProfileId(
    profileId: string,
    options?: ConnectionTestOptions
  ): Promise<ConnectionTestResult> {
    try {
      return await invoke('test_connection_by_profile_id', {
        profileId,
        options: options || DEFAULT_CONNECTION_TEST_OPTIONS,
      });
    } catch (error) {
      console.error('Failed to test connection by profile ID:', error);
      throw error;
    }
  }

  /**
   * Validate connection configuration parameters
   */
  static async validateConnectionConfig(
    config: AdvancedConnectionConfig
  ): Promise<ConnectionValidationError[]> {
    try {
      return await invoke('validate_connection_config', { config });
    } catch (error) {
      console.error('Failed to validate connection config:', error);
      throw error;
    }
  }

  /**
   * Get health history for a profile
   */
  static async getProfileHealthHistory(profileId: string): Promise<HealthCheckResult[]> {
    try {
      return await invoke('get_profile_health_history', { profileId });
    } catch (error) {
      console.error('Failed to get profile health history:', error);
      throw error;
    }
  }

  /**
   * Get current health status for a profile
   */
  static async getProfileCurrentHealth(profileId: string): Promise<ConnectionHealth | null> {
    try {
      return await invoke('get_profile_current_health', { profileId });
    } catch (error) {
      console.error('Failed to get profile current health:', error);
      throw error;
    }
  }

  /**
   * Calculate uptime percentage for a profile over a specified period
   */
  static async calculateProfileUptime(profileId: string, periodHours: number): Promise<number> {
    try {
      return await invoke('calculate_profile_uptime', { profileId, periodHours });
    } catch (error) {
      console.error('Failed to calculate profile uptime:', error);
      throw error;
    }
  }

  /**
   * Batch test multiple profiles
   */
  static async batchTestProfiles(
    profileIds: string[],
    options?: ConnectionTestOptions
  ): Promise<Array<[string, ConnectionTestResult]>> {
    try {
      return await invoke('batch_test_profiles', {
        profileIds,
        options: options || DEFAULT_CONNECTION_TEST_OPTIONS,
      });
    } catch (error) {
      console.error('Failed to batch test profiles:', error);
      throw error;
    }
  }

  /**
   * Quick connection test with minimal information
   */
  static async quickConnectionTest(
    host: string,
    port: number,
    database: string,
    username: string,
    password: string
  ): Promise<ConnectionTestResult> {
    try {
      return await invoke('quick_connection_test', {
        host,
        port,
        database,
        username,
        password,
      });
    } catch (error) {
      console.error('Failed to perform quick connection test:', error);
      throw error;
    }
  }

  /**
   * Get connection troubleshooting suggestions based on error patterns
   */
  static async getConnectionTroubleshootingSuggestions(errorMessage: string): Promise<string[]> {
    try {
      return await invoke('get_connection_troubleshooting_suggestions', { errorMessage });
    } catch (error) {
      console.error('Failed to get troubleshooting suggestions:', error);
      throw error;
    }
  }

  /**
   * Test connection with comprehensive error handling and user-friendly messages
   */
  static async testConnectionWithErrorHandling(
    config: AdvancedConnectionConfig,
    password: string,
    options?: ConnectionTestOptions
  ): Promise<{
    result: ConnectionTestResult;
    userFriendlyMessage: string;
    suggestions: string[];
  }> {
    try {
      const result = await this.testConnectionConfig(config, password, options);
      
      let userFriendlyMessage: string;
      let suggestions: string[] = [];

      if (result.success) {
        const responseTime = result.response_time_ms ? ` in ${result.response_time_ms}ms` : '';
        userFriendlyMessage = `Successfully connected to ${config.database} on ${config.host}${responseTime}`;
        
        if (result.server_version) {
          userFriendlyMessage += ` (${result.server_version})`;
        }
      } else {
        userFriendlyMessage = result.error_message || 'Connection failed for unknown reason';
        suggestions = result.troubleshooting_hints || [];
        
        // Get additional suggestions if we have an error message
        if (result.error_message) {
          try {
            const additionalSuggestions = await this.getConnectionTroubleshootingSuggestions(
              result.error_message
            );
            suggestions = [...new Set([...suggestions, ...additionalSuggestions])];
          } catch (error) {
            console.warn('Failed to get additional troubleshooting suggestions:', error);
          }
        }
      }

      return {
        result,
        userFriendlyMessage,
        suggestions,
      };
    } catch (error) {
      console.error('Failed to test connection with error handling:', error);
      
      return {
        result: {
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error occurred',
          error_code: 'INTERNAL_ERROR',
          troubleshooting_hints: ['Check the application logs for more details'],
        } as ConnectionTestResult,
        userFriendlyMessage: 'An internal error occurred while testing the connection',
        suggestions: [
          'Check the application logs for more details',
          'Try restarting the application',
          'Contact support if the problem persists',
        ],
      };
    }
  }

  /**
   * Validate and test connection in one call
   */
  static async validateAndTestConnection(
    config: AdvancedConnectionConfig,
    password: string,
    options?: ConnectionTestOptions
  ): Promise<{
    validationErrors: ConnectionValidationError[];
    testResult?: ConnectionTestResult;
    isValid: boolean;
    canConnect: boolean;
  }> {
    try {
      // First validate the configuration
      const validationErrors = await this.validateConnectionConfig(config);
      const isValid = validationErrors.length === 0;

      let testResult: ConnectionTestResult | undefined;
      let canConnect = false;

      // Only test connection if validation passes
      if (isValid) {
        testResult = await this.testConnectionConfig(config, password, options);
        canConnect = testResult.success;
      }

      return {
        validationErrors,
        testResult,
        isValid,
        canConnect,
      };
    } catch (error) {
      console.error('Failed to validate and test connection:', error);
      throw error;
    }
  }

  /**
   * Get health summary for multiple profiles
   */
  static async getHealthSummaryForProfiles(profileIds: string[]): Promise<{
    [profileId: string]: {
      health: ConnectionHealth | null;
      uptime24h: number;
      uptime7d: number;
    };
  }> {
    const summary: {
      [profileId: string]: {
        health: ConnectionHealth | null;
        uptime24h: number;
        uptime7d: number;
      };
    } = {};

    // Process profiles in parallel
    const promises = profileIds.map(async (profileId) => {
      try {
        const [health, uptime24h, uptime7d] = await Promise.all([
          this.getProfileCurrentHealth(profileId),
          this.calculateProfileUptime(profileId, 24),
          this.calculateProfileUptime(profileId, 24 * 7),
        ]);

        summary[profileId] = {
          health,
          uptime24h,
          uptime7d,
        };
      } catch (error) {
        console.error(`Failed to get health summary for profile ${profileId}:`, error);
        summary[profileId] = {
          health: null,
          uptime24h: 0,
          uptime7d: 0,
        };
      }
    });

    await Promise.all(promises);
    return summary;
  }

  /**
   * Monitor profile health with periodic checks
   */
  static async startHealthMonitoring(
    profileId: string,
    intervalMinutes: number = 5,
    onHealthUpdate?: (profileId: string, health: ConnectionHealth) => void
  ): Promise<() => void> {
    const intervalId = setInterval(async () => {
      try {
        const result = await this.testConnectionByProfileId(profileId);
        const health: ConnectionHealth = {
          status: result.success ? 'healthy' : 'error',
          last_checked: new Date().toISOString(),
          response_time_ms: result.response_time_ms,
          error_message: result.error_message,
        };

        if (onHealthUpdate) {
          onHealthUpdate(profileId, health);
        }
      } catch (error) {
        console.error(`Health monitoring failed for profile ${profileId}:`, error);
        
        if (onHealthUpdate) {
          onHealthUpdate(profileId, {
            status: 'error',
            last_checked: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Monitoring failed',
          });
        }
      }
    }, intervalMinutes * 60 * 1000);

    // Return cleanup function
    return () => {
      clearInterval(intervalId);
    };
  }
}