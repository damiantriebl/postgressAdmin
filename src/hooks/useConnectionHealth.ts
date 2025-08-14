import { useState, useEffect, useCallback, useRef } from 'react';
import { ConnectionHealthService } from '../services/connection-health-service';
import {
  ConnectionTestResult,
  ConnectionTestOptions,
  ConnectionValidationError,
  ConnectionHealth,
  HealthCheckResult,
  DEFAULT_CONNECTION_TEST_OPTIONS,
} from '../types/connection-health';
import { ConnectionProfile, AdvancedConnectionConfig } from '../types/connection-profile';

export interface UseConnectionHealthOptions {
  autoTest?: boolean;
  testInterval?: number; // minutes
  enableMonitoring?: boolean;
}

export interface ConnectionHealthState {
  isLoading: boolean;
  lastTestResult: ConnectionTestResult | null;
  validationErrors: ConnectionValidationError[];
  health: ConnectionHealth | null;
  history: HealthCheckResult[];
  uptime24h: number;
  uptime7d: number;
  error: string | null;
}

export const useConnectionHealth = (
  profileId?: string,
  options: UseConnectionHealthOptions = {}
) => {
  const [state, setState] = useState<ConnectionHealthState>({
    isLoading: false,
    lastTestResult: null,
    validationErrors: [],
    health: null,
    history: [],
    uptime24h: 0,
    uptime7d: 0,
    error: null,
  });

  const monitoringCleanupRef = useRef<(() => void) | null>(null);

  // Test connection by profile ID
  const testConnection = useCallback(
    async (testOptions?: ConnectionTestOptions) => {
      if (!profileId) {
        setState(prev => ({
          ...prev,
          error: 'No profile ID provided',
        }));
        return null;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await ConnectionHealthService.testConnectionByProfileId(
          profileId,
          testOptions || DEFAULT_CONNECTION_TEST_OPTIONS
        );

        setState(prev => ({
          ...prev,
          lastTestResult: result,
          isLoading: false,
        }));

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
        return null;
      }
    },
    [profileId]
  );

  // Test connection with config and password
  const testConnectionConfig = useCallback(
    async (
      config: AdvancedConnectionConfig,
      password: string,
      testOptions?: ConnectionTestOptions
    ) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await ConnectionHealthService.testConnectionConfig(
          config,
          password,
          testOptions || DEFAULT_CONNECTION_TEST_OPTIONS
        );

        setState(prev => ({
          ...prev,
          lastTestResult: result,
          isLoading: false,
        }));

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
        return null;
      }
    },
    []
  );

  // Validate connection configuration
  const validateConfig = useCallback(async (config: AdvancedConnectionConfig) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const errors = await ConnectionHealthService.validateConnectionConfig(config);
      setState(prev => ({
        ...prev,
        validationErrors: errors,
        isLoading: false,
      }));
      return errors;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return [];
    }
  }, []);

  // Load health data for the profile
  const loadHealthData = useCallback(async () => {
    if (!profileId) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const [health, history, uptime24h, uptime7d] = await Promise.all([
        ConnectionHealthService.getProfileCurrentHealth(profileId),
        ConnectionHealthService.getProfileHealthHistory(profileId),
        ConnectionHealthService.calculateProfileUptime(profileId, 24),
        ConnectionHealthService.calculateProfileUptime(profileId, 24 * 7),
      ]);

      setState(prev => ({
        ...prev,
        health,
        history,
        uptime24h,
        uptime7d,
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
    }
  }, [profileId]);

  // Start health monitoring
  const startMonitoring = useCallback(
    async (intervalMinutes: number = 5) => {
      if (!profileId) return;

      // Stop existing monitoring
      if (monitoringCleanupRef.current) {
        monitoringCleanupRef.current();
      }

      try {
        const cleanup = await ConnectionHealthService.startHealthMonitoring(
          profileId,
          intervalMinutes,
          (id, health) => {
            setState(prev => ({
              ...prev,
              health,
            }));
          }
        );

        monitoringCleanupRef.current = cleanup;
      } catch (error) {
        console.error('Failed to start health monitoring:', error);
        setState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to start monitoring',
        }));
      }
    },
    [profileId]
  );

  // Stop health monitoring
  const stopMonitoring = useCallback(() => {
    if (monitoringCleanupRef.current) {
      monitoringCleanupRef.current();
      monitoringCleanupRef.current = null;
    }
  }, []);

  // Get troubleshooting suggestions
  const getTroubleshootingSuggestions = useCallback(async (errorMessage: string) => {
    try {
      return await ConnectionHealthService.getConnectionTroubleshootingSuggestions(errorMessage);
    } catch (error) {
      console.error('Failed to get troubleshooting suggestions:', error);
      return [];
    }
  }, []);

  // Refresh all health data
  const refresh = useCallback(async () => {
    await loadHealthData();
  }, [loadHealthData]);

  // Load initial data when profileId changes
  useEffect(() => {
    if (profileId) {
      loadHealthData();
    }
  }, [profileId, loadHealthData]);

  // Start monitoring if enabled
  useEffect(() => {
    if (options.enableMonitoring && profileId) {
      startMonitoring(options.testInterval || 5);
    }

    return () => {
      stopMonitoring();
    };
  }, [options.enableMonitoring, options.testInterval, profileId, startMonitoring, stopMonitoring]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);

  return {
    ...state,
    testConnection,
    testConnectionConfig,
    validateConfig,
    loadHealthData,
    startMonitoring,
    stopMonitoring,
    getTroubleshootingSuggestions,
    refresh,
    isMonitoring: monitoringCleanupRef.current !== null,
  };
};

// Hook for batch testing multiple profiles
export const useBatchConnectionHealth = () => {
  const [state, setState] = useState<{
    isLoading: boolean;
    results: Array<[string, ConnectionTestResult]>;
    error: string | null;
  }>({
    isLoading: false,
    results: [],
    error: null,
  });

  const batchTest = useCallback(
    async (profileIds: string[], options?: ConnectionTestOptions) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const results = await ConnectionHealthService.batchTestProfiles(
          profileIds,
          options || DEFAULT_CONNECTION_TEST_OPTIONS
        );

        setState(prev => ({
          ...prev,
          results,
          isLoading: false,
        }));

        return results;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
        return [];
      }
    },
    []
  );

  const getHealthSummary = useCallback(async (profileIds: string[]) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const summary = await ConnectionHealthService.getHealthSummaryForProfiles(profileIds);
      setState(prev => ({ ...prev, isLoading: false }));
      return summary;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
      return {};
    }
  }, []);

  return {
    ...state,
    batchTest,
    getHealthSummary,
  };
};

// Hook for quick connection testing without profiles
export const useQuickConnectionTest = () => {
  const [state, setState] = useState<{
    isLoading: boolean;
    result: ConnectionTestResult | null;
    error: string | null;
  }>({
    isLoading: false,
    result: null,
    error: null,
  });

  const quickTest = useCallback(
    async (
      host: string,
      port: number,
      database: string,
      username: string,
      password: string
    ) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const result = await ConnectionHealthService.quickConnectionTest(
          host,
          port,
          database,
          username,
          password
        );

        setState(prev => ({
          ...prev,
          result,
          isLoading: false,
        }));

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setState(prev => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
        }));
        return null;
      }
    },
    []
  );

  return {
    ...state,
    quickTest,
  };
};