import { useState, useEffect } from "react";
import { Database, Settings, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DatabaseService, ConnectionStatus, ConnectionDisplayInfo } from "@/services/database";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { errorToString } from "@/utils/error";


interface ConnectionManagerProps {
  onConnectionChange?: (connected: boolean) => void;
  onNavigateToSchema?: () => void;
}

export default function ConnectionManager({ onConnectionChange, onNavigateToSchema }: ConnectionManagerProps) {
  const { addToast } = useToast();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [connectionString, setConnectionString] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionDisplayInfo | null>(null);
  const [saveConnection, setSaveConnection] = useState(false);
  const [hasSavedConnection, setHasSavedConnection] = useState(false);

  const refreshConnectionStatus = async () => {
    try {
      console.log('🔄 [ConnectionManager] Refreshing connection status...');
      const status = await DatabaseService.getConnectionStatus();
      console.log('🔄 [ConnectionManager] Connection status received:', status);
      setConnectionStatus(status);
      
      // Get connection info if connected
      if (status.connected) {
        console.log('🔄 [ConnectionManager] Getting connection info...');
        const info = await DatabaseService.getConnectionInfo();
        console.log('🔄 [ConnectionManager] Connection info:', info);
        setConnectionInfo(info);
      } else {
        console.log('🔄 [ConnectionManager] Not connected, clearing connection info');
        setConnectionInfo(null);
      }

      // Notify parent component of connection change
      console.log('🔄 [ConnectionManager] Notifying parent of connection change:', status.connected);
      onConnectionChange?.(status.connected);
    } catch (error) {
      console.error("🔄 [ConnectionManager] Failed to get connection status:", error);
      // Set disconnected state on error
      setConnectionStatus({ connected: false, message: "Failed to get connection status" });
      setConnectionInfo(null);
      onConnectionChange?.(false);
    }
  };

  const validateConnectionString = async (value: string) => {
    if (!value.trim()) {
      setValidationMessage("");
      return;
    }

    setIsValidating(true);
    try {
      await DatabaseService.validateConnectionString(value);
      setValidationMessage("✅ Connection string is valid");
    } catch (error) {
      setValidationMessage(`❌ ${error}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleConnect = async () => {
    if (!connectionString.trim()) {
      setConnectionMessage("Please enter a connection string");
      return;
    }

    setIsConnecting(true);
    setConnectionMessage("");

    try {
      const result = await DatabaseService.connect(connectionString.trim(), saveConnection);
      setConnectionMessage(result);
      addToast({
        type: 'success',
        title: 'Connected',
        message: 'Successfully connected to database',
      });
      await refreshConnectionStatus();
      await checkSavedConnection();
    } catch (error) {
      setConnectionMessage(errorToString(error));
      addToast({
        type: 'error',
        title: 'Connection Failed',
        message: errorToString(error),
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const result = await DatabaseService.disconnect();
      setConnectionMessage(result);
      addToast({
        type: 'info',
        title: 'Disconnected',
        message: 'Disconnected from database',
      });
      await refreshConnectionStatus();
    } catch (error) {
      setConnectionMessage(errorToString(error));
      addToast({
        type: 'error',
        title: 'Disconnect Failed',
        message: errorToString(error),
      });
    }
  };

  const handleAutoReconnect = async () => {
    setIsConnecting(true);
    setConnectionMessage("");

    try {
      const success = await DatabaseService.autoReconnect();
      if (success) {
        setConnectionMessage("Auto-reconnected successfully!");
        await refreshConnectionStatus();
      } else {
        setConnectionMessage("No saved connection found or auto-reconnect failed");
      }
    } catch (error) {
      setConnectionMessage(errorToString(error));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDeleteSavedConnection = async () => {
    try {
      const result = await DatabaseService.deleteSavedConnection();
      setConnectionMessage(result);
      await checkSavedConnection();
    } catch (error) {
      setConnectionMessage(errorToString(error));
    }
  };

  const checkSavedConnection = async () => {
    try {
      const hasSaved = await DatabaseService.hasSavedConnection();
      setHasSavedConnection(hasSaved);
    } catch (error) {
      console.error("Failed to check saved connection:", error);
    }
  };

  const handleTestConnection = async () => {
    if (!connectionStatus?.connected) {
      setConnectionMessage("Not connected to database");
      return;
    }

    try {
      const result = await DatabaseService.testConnection();
      setConnectionMessage(result);
      addToast({
        type: 'success',
        title: 'Connection Test',
        message: 'Connection test successful',
      });
    } catch (error) {
      setConnectionMessage(errorToString(error));
      addToast({
        type: 'error',
        title: 'Connection Test Failed',
        message: errorToString(error),
      });
    }
  };

  useEffect(() => {
    // Get initial connection status
    refreshConnectionStatus();
    checkSavedConnection();

    // Disabled auto-reconnect to prevent state mismatch issues
    // User must manually connect
    console.log('🔄 [ConnectionManager] Auto-reconnect disabled, user must connect manually');
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="bg-gray-800/90 backdrop-blur-sm border-gray-700/50 shadow-xl hover:bg-gray-800 transition-all duration-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-lg text-white">
              <Settings className="h-5 w-5 text-blue-400" />
              <span>Database Connection</span>
            </CardTitle>
            {connectionStatus && (
              <div className="flex items-center space-x-2">
                {connectionStatus.connected ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-400" />
                )}
                <Badge 
                  variant={connectionStatus.connected ? "secondary" : "destructive"}
                  className="glass-effect"
                >
                  {connectionStatus.connected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="connection-string" className="block text-sm font-medium text-gray-300 mb-2">
                Neon PostgreSQL Connection String
              </label>
              <Textarea
                id="connection-string"
                placeholder="postgresql://username:password@host:port/database?sslmode=require"
                value={connectionString}
                onChange={(e) => {
                  const value = e.target.value;
                  setConnectionString(value);
                  setConnectionMessage("");
                  
                  // Debounce validation
                  setTimeout(() => {
                    validateConnectionString(value);
                  }, 500);
                }}
                className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-400 min-h-[80px] font-mono text-sm"
                disabled={isConnecting}
                aria-describedby="connection-help"
                spellCheck={false}
                autoComplete="off"
              />
              
              {/* Hidden help text for screen readers */}
              <div id="connection-help" className="sr-only">
                Enter your PostgreSQL connection string. The format should be: postgresql://username:password@host:port/database?sslmode=require
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-500">
                  Example: postgresql://user:pass@ep-example-123.neon.tech/dbname?sslmode=require
                </p>
                {isValidating && (
                  <LoadingSpinner size="sm" text="Validating..." className="text-xs text-blue-400" />
                )}
              </div>
              {validationMessage && (
                <p className={`text-xs mt-1 ${
                  validationMessage.includes('✅') ? 'text-green-400' : 'text-red-400'
                }`}>
                  {validationMessage}
                </p>
              )}
            </div>

            {!connectionStatus?.connected && (
              <div className="flex items-center space-x-2 p-3 rounded-lg bg-gray-900/30 border border-gray-700">
                <Checkbox 
                  id="save-connection"
                  checked={saveConnection}
                  onCheckedChange={(checked) => setSaveConnection(checked as boolean)}
                />
                <label htmlFor="save-connection" className="text-sm text-gray-300 cursor-pointer">
                  Save connection securely for auto-reconnect
                </label>
              </div>
            )}

            <div className="flex space-x-2 flex-wrap gap-2">
              {connectionStatus?.connected ? (
                <>
                  <Button 
                    onClick={handleDisconnect}
                    variant="outline"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Disconnect
                  </Button>
                  <Button 
                    onClick={handleTestConnection}
                    variant="outline"
                    className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    Test Connection
                  </Button>
                  <Button 
                    onClick={refreshConnectionStatus}
                    variant="outline"
                    className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Refresh Status
                  </Button>
                  {onNavigateToSchema && (
                    <Button 
                      onClick={onNavigateToSchema}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Database className="h-4 w-4 mr-2" />
                      Go to Schema Explorer
                    </Button>
                  )}
                  {hasSavedConnection && (
                    <Button 
                      onClick={handleDeleteSavedConnection}
                      variant="outline"
                      className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                    >
                      Delete Saved
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button 
                    onClick={handleConnect}
                    disabled={isConnecting || !connectionString.trim()}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isConnecting ? (
                      <LoadingSpinner size="sm" text="Connecting..." />
                    ) : (
                      <>
                        <Database className="h-4 w-4 mr-2" />
                        Connect
                      </>
                    )}
                  </Button>
                  {hasSavedConnection && (
                    <Button 
                      onClick={handleAutoReconnect}
                      disabled={isConnecting}
                      variant="outline"
                      className="border-green-500/50 text-green-400 hover:bg-green-500/10"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Auto-Reconnect
                    </Button>
                  )}
                  <Button 
                    onClick={async () => {
                      console.log('🧹 [Clear] Clearing all state...');
                      try {
                        // Force disconnect
                        await DatabaseService.disconnect();
                        // Clear local state
                        setConnectionStatus({ connected: false, message: "State cleared" });
                        setConnectionInfo(null);
                        setConnectionMessage("All state cleared - ready for fresh connection");
                        onConnectionChange?.(false);
                        
                        addToast({
                          type: 'info',
                          title: 'State Cleared',
                          message: 'All connection state has been cleared',
                        });
                      } catch (error) {
                        console.error('🧹 [Clear] Error clearing state:', error);
                      }
                    }}
                    variant="outline"
                    className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Clear State
                  </Button>


                </>
              )}
            </div>

            {connectionMessage && (
              <Alert className={`glass-effect ${
                connectionMessage.includes('success') || connectionMessage.includes('Connected') || connectionMessage.includes('Auto-reconnected')
                  ? 'border-green-500/20 bg-green-500/10'
                  : 'border-red-500/20 bg-red-500/10'
              }`}>
                {connectionMessage.includes('success') || connectionMessage.includes('Connected') || connectionMessage.includes('Auto-reconnected') ? (
                  <CheckCircle className="h-4 w-4 text-green-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-400" />
                )}
                <AlertDescription className={
                  connectionMessage.includes('success') || connectionMessage.includes('Connected') || connectionMessage.includes('Auto-reconnected')
                    ? 'text-green-300'
                    : 'text-red-300'
                }>
                  {connectionMessage}
                </AlertDescription>
              </Alert>
            )}

            {connectionStatus && (
              <div className="p-3 rounded-lg bg-gray-900/50 border border-gray-600">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Database className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium text-gray-300">Connection Status</span>
                  </div>
                  {hasSavedConnection && (
                    <div className="flex items-center space-x-1">
                      <CheckCircle className="h-3 w-3 text-green-400" />
                      <span className="text-xs text-green-400">Saved</span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-400 mb-2">{connectionStatus.message}</p>
                
                {connectionInfo && (
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Host:</span>
                      <span className="text-gray-300">{connectionInfo.host}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Database:</span>
                      <span className="text-gray-300">{connectionInfo.database}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">User:</span>
                      <span className="text-gray-300">{connectionInfo.username}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">SSL:</span>
                      <span className={connectionInfo.ssl_enabled ? 'text-green-400' : 'text-red-400'}>
                        {connectionInfo.ssl_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}