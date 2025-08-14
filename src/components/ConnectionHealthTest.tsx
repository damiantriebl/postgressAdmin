import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useQuickConnectionTest } from '../hooks/useConnectionHealth';
import {
  ConnectionTestResult,
  getHealthStatusColor,
  getHealthStatusIcon,
  formatResponseTime,
  getConnectionTestSummary,
} from '../types/connection-health';

interface ConnectionFormData {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export const ConnectionHealthTest: React.FC = () => {
  const [formData, setFormData] = useState<ConnectionFormData>({
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    username: 'postgres',
    password: '',
  });

  const { isLoading, result, error, quickTest } = useQuickConnectionTest();

  const handleInputChange = (field: keyof ConnectionFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleTest = async () => {
    await quickTest(
      formData.host,
      formData.port,
      formData.database,
      formData.username,
      formData.password
    );
  };

  const getResultIcon = (result: ConnectionTestResult) => {
    if (result.success) {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    } else {
      return <XCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const getResultBadgeVariant = (result: ConnectionTestResult) => {
    return result.success ? 'default' : 'destructive';
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Connection Health Test</CardTitle>
          <CardDescription>
            Test database connections and validate configuration parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={formData.host}
                onChange={(e) => handleInputChange('host', e.target.value)}
                placeholder="localhost"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={formData.port}
                onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 5432)}
                placeholder="5432"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="database">Database</Label>
            <Input
              id="database"
              value={formData.database}
              onChange={(e) => handleInputChange('database', e.target.value)}
              placeholder="postgres"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              placeholder="postgres"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder="Enter password"
            />
          </div>

          <Button
            onClick={handleTest}
            disabled={isLoading || !formData.password}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Connection...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getResultIcon(result)}
              Connection Test Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={getResultBadgeVariant(result)}>
                {result.success ? 'Success' : 'Failed'}
              </Badge>
              {result.response_time_ms && (
                <Badge variant="outline">
                  {formatResponseTime(result.response_time_ms)}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Summary:</p>
              <p className="text-sm text-muted-foreground">
                {getConnectionTestSummary(result)}
              </p>
            </div>

            {result.server_version && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Server Version:</p>
                <p className="text-sm text-muted-foreground">{result.server_version}</p>
              </div>
            )}

            {result.connection_details && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Connection Details:</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Host: {result.connection_details.host}:{result.connection_details.port}</p>
                  <p>Database: {result.connection_details.database}</p>
                  <p>Username: {result.connection_details.username}</p>
                  <p>SSL Used: {result.connection_details.ssl_used ? 'Yes' : 'No'}</p>
                </div>
              </div>
            )}

            {result.error_message && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-600">Error:</p>
                <p className="text-sm text-red-600">{result.error_message}</p>
                {result.error_code && (
                  <Badge variant="outline" className="text-red-600">
                    {result.error_code}
                  </Badge>
                )}
              </div>
            )}

            {result.troubleshooting_hints && result.troubleshooting_hints.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Troubleshooting Suggestions:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {result.troubleshooting_hints.map((hint, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-blue-600">•</span>
                      {hint}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConnectionHealthTest;