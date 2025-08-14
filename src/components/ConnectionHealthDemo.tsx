import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Separator } from './ui/separator';
import { ScrollArea } from './ui/scroll-area';
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Activity,
  Database,
  Clock,
  Zap
} from 'lucide-react';
import { useConnectionHealth, useBatchConnectionHealth } from '../hooks/useConnectionHealth';
import { ConnectionHealthService } from '../services/connection-health-service';
import {
  ConnectionTestResult,
  getHealthStatusColor,
  getHealthStatusIcon,
  formatResponseTime,
  formatUptime,
  getConnectionTestSummary,
} from '../types/connection-health';

interface ConnectionHealthDemoProps {
  profileIds?: string[];
}

export const ConnectionHealthDemo: React.FC<ConnectionHealthDemoProps> = ({ 
  profileIds = [] 
}) => {
  const [selectedProfileId, setSelectedProfileId] = useState<string | undefined>(
    profileIds[0]
  );
  const [troubleshootingSuggestions, setTroubleshootingSuggestions] = useState<string[]>([]);

  const {
    isLoading,
    lastTestResult,
    validationErrors,
    health,
    history,
    uptime24h,
    uptime7d,
    error,
    testConnection,
    refresh,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
  } = useConnectionHealth(selectedProfileId, {
    enableMonitoring: false,
    testInterval: 5,
  });

  const {
    isLoading: isBatchLoading,
    results: batchResults,
    error: batchError,
    batchTest,
    getHealthSummary,
  } = useBatchConnectionHealth();

  const [healthSummary, setHealthSummary] = useState<{
    [profileId: string]: {
      health: any;
      uptime24h: number;
      uptime7d: number;
    };
  }>({});

  // Load health summary when profile IDs change
  useEffect(() => {
    if (profileIds.length > 0) {
      getHealthSummary(profileIds).then(setHealthSummary);
    }
  }, [profileIds, getHealthSummary]);

  // Get troubleshooting suggestions when there's an error
  useEffect(() => {
    if (lastTestResult && !lastTestResult.success && lastTestResult.error_message) {
      ConnectionHealthService.getConnectionTroubleshootingSuggestions(
        lastTestResult.error_message
      ).then(setTroubleshootingSuggestions);
    }
  }, [lastTestResult]);

  const handleTestConnection = async () => {
    await testConnection();
  };

  const handleBatchTest = async () => {
    if (profileIds.length > 0) {
      await batchTest(profileIds);
    }
  };

  const handleStartMonitoring = async () => {
    await startMonitoring(5); // 5 minute intervals
  };

  const handleStopMonitoring = () => {
    stopMonitoring();
  };

  const getStatusBadgeVariant = (success: boolean) => {
    return success ? 'default' : 'destructive';
  };

  const getHealthBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'warning':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Connection Health Monitor</h1>
          <p className="text-muted-foreground">
            Monitor and test database connection health
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleBatchTest}
            disabled={isBatchLoading || profileIds.length === 0}
            variant="outline"
          >
            {isBatchLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing All...
              </>
            ) : (
              <>
                <Activity className="mr-2 h-4 w-4" />
                Test All Connections
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Profile Selection */}
      {profileIds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Connection Profiles
            </CardTitle>
            <CardDescription>
              Select a profile to view detailed health information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {profileIds.map((profileId) => (
                <Button
                  key={profileId}
                  variant={selectedProfileId === profileId ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedProfileId(profileId)}
                  className="flex items-center gap-2"
                >
                  {healthSummary[profileId]?.health && (
                    <span className={getHealthStatusColor(healthSummary[profileId].health.status)}>
                      {getHealthStatusIcon(healthSummary[profileId].health.status)}
                    </span>
                  )}
                  {profileId}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Individual Profile Health */}
      {selectedProfileId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Connection Test
              </CardTitle>
              <CardDescription>
                Test connection and view current status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={handleTestConnection}
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Test Connection
                    </>
                  )}
                </Button>
                <Button
                  onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
                  variant="outline"
                >
                  {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
                </Button>
              </div>

              {lastTestResult && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(lastTestResult.success)}>
                      {lastTestResult.success ? 'Success' : 'Failed'}
                    </Badge>
                    {lastTestResult.response_time_ms && (
                      <Badge variant="outline">
                        {formatResponseTime(lastTestResult.response_time_ms)}
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {getConnectionTestSummary(lastTestResult)}
                  </p>

                  {lastTestResult.server_version && (
                    <p className="text-sm">
                      <span className="font-medium">Server:</span> {lastTestResult.server_version}
                    </p>
                  )}

                  {lastTestResult.error_message && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{lastTestResult.error_message}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Health Statistics
              </CardTitle>
              <CardDescription>
                Connection uptime and health metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {health && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={getHealthStatusColor(health.status)}>
                      {getHealthStatusIcon(health.status)}
                    </span>
                    <Badge variant={getHealthBadgeVariant(health.status)}>
                      {health.status.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium">24h Uptime</p>
                      <p className="text-muted-foreground">{formatUptime(uptime24h)}</p>
                    </div>
                    <div>
                      <p className="font-medium">7d Uptime</p>
                      <p className="text-muted-foreground">{formatUptime(uptime7d)}</p>
                    </div>
                  </div>

                  <div className="text-sm">
                    <p className="font-medium">Last Checked</p>
                    <p className="text-muted-foreground">
                      {new Date(health.last_checked).toLocaleString()}
                    </p>
                  </div>

                  {health.response_time_ms && (
                    <div className="text-sm">
                      <p className="font-medium">Response Time</p>
                      <p className="text-muted-foreground">
                        {formatResponseTime(health.response_time_ms)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Button onClick={refresh} variant="outline" size="sm" className="w-full">
                Refresh Health Data
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Troubleshooting Suggestions */}
      {troubleshootingSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Troubleshooting Suggestions
            </CardTitle>
            <CardDescription>
              Recommendations to resolve connection issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {troubleshootingSuggestions.map((suggestion, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-blue-600 mt-1">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Batch Test Results */}
      {batchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Batch Test Results
            </CardTitle>
            <CardDescription>
              Results from testing multiple connections
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {batchResults.map(([profileId, result]) => (
                  <div key={profileId} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{profileId}</span>
                      <Badge variant={getStatusBadgeVariant(result.success)}>
                        {result.success ? 'Success' : 'Failed'}
                      </Badge>
                      {result.response_time_ms && (
                        <Badge variant="outline">
                          {formatResponseTime(result.response_time_ms)}
                        </Badge>
                      )}
                    </div>
                    {result.error_message && (
                      <p className="text-sm text-red-600 max-w-md truncate">
                        {result.error_message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Health History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Health History
            </CardTitle>
            <CardDescription>
              Recent connection health check results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {history.slice(-10).reverse().map((check, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <span className={getHealthStatusColor(check.status)}>
                        {getHealthStatusIcon(check.status)}
                      </span>
                      <Badge variant={getHealthBadgeVariant(check.status)} size="sm">
                        {check.status}
                      </Badge>
                      {check.response_time_ms && (
                        <span className="text-sm text-muted-foreground">
                          {formatResponseTime(check.response_time_ms)}
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {new Date(check.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Configuration Validation Errors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {validationErrors.map((error, index) => (
                <Alert key={index} variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {JSON.stringify(error)}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {batchError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{batchError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ConnectionHealthDemo;