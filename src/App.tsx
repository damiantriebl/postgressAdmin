import { useState, useEffect } from "react";
import { DatabaseService, ConnectionStatus } from "./services/database";
import { ToastProvider, ToastContainer } from "./components/Toast";
import ErrorBoundary from "./components/ErrorBoundary";
import ConnectionManager from "./components/ConnectionManager";
import SchemaExplorer from "./components/SchemaExplorer";
import QueryEditor from "./components/QueryEditor";
import ResultsViewer from "./components/ResultsViewer";
import { ConnectionProfileManagerDemo } from "./components/ConnectionProfileManagerDemo";
import { QueryResult } from "./types/database";
import { useKeyboardShortcuts, COMMON_SHORTCUTS } from "./hooks/useKeyboardShortcuts";
import HelpDialog from "./components/HelpDialog";
import Tooltip from "./components/Tooltip";

// shadcn/ui components
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";

// Lucide React icons
import {
  Database,
  CheckCircle,
  XCircle,
  ArrowLeft,
  X,
  Layers,
  ExternalLink,
  HelpCircle,
  Settings,

} from "lucide-react";

import "./index.css";

type Page = 'connection' | 'schema' | 'profiles';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('connection');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [lastStatusCheck, setLastStatusCheck] = useState<number>(0);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentQuery, setCurrentQuery] = useState("");
  const [currentTable, setCurrentTable] = useState<{ name: string, schema: string } | null>(null);
  const [isQueryEditorCollapsed, setIsQueryEditorCollapsed] = useState(true);
  const [showHelpDialog, setShowHelpDialog] = useState(false);

  // State for related tables
  const [relatedTableResults, setRelatedTableResults] = useState<Array<{
    tableName: string;
    schemaName: string;
    queryResult: QueryResult;
    filterInfo: {
      columnName: string;
      value: any;
      parentTable: string;
    };
  }>>([]);

  // State to track table row counts
  const [tableRowCounts, setTableRowCounts] = useState<Map<string, number>>(new Map());



  // Setup keyboard shortcuts
  useKeyboardShortcuts([
    {
      ...COMMON_SHORTCUTS.HELP,
      action: () => setShowHelpDialog(true)
    },
    {
      ...COMMON_SHORTCUTS.TOGGLE_SIDEBAR,
      action: () => {
        // Toggle between connection and schema pages
        if (currentPage === 'connection') {
          setCurrentPage('schema');
        } else {
          setCurrentPage('connection');
        }
      }
    },
    {
      ...COMMON_SHORTCUTS.EXECUTE_QUERY,
      action: () => {
        if (currentQuery.trim() && !isExecuting) {
          handleExecuteQuery(currentQuery);
        }
      }
    },
    {
      ...COMMON_SHORTCUTS.REFRESH_SCHEMA,
      action: () => {
        if (currentPage === 'schema') {
          // Trigger schema refresh
          refreshConnectionStatus(true);
        }
      }
    }
  ]);

  const refreshConnectionStatus = async (force: boolean = false) => {
    const now = Date.now();

    // Only check status if forced or if it's been more than 5 seconds since last check
    if (!force && (now - lastStatusCheck) < 5000) {
      console.log('🔄 [App] Skipping status check - too recent');
      return;
    }

    try {
      console.log('🔄 [App] Refreshing connection status...');
      const status = await DatabaseService.getConnectionStatus();
      console.log('🔄 [App] Connection status:', status);
      setConnectionStatus(status);
      setLastStatusCheck(now);

      // Only auto-navigate if we're sure the connection is real
      // Removed automatic navigation to prevent state mismatch issues

      // Volver a conexión si se desconecta
      if (!status.connected && currentPage === 'schema') {
        console.log('🔄 [App] Not connected, going back to connection page');
        setCurrentPage('connection');
      }
    } catch (error) {
      console.error("🔄 [App] Failed to get connection status:", error);
      // On error, assume disconnected
      setConnectionStatus({ connected: false, message: "Connection status error" });
      setLastStatusCheck(now);
      if (currentPage === 'schema') {
        setCurrentPage('connection');
      }
    }
  };

  const handleConnectionChange = (_connected: boolean) => {
    refreshConnectionStatus(true); // Force refresh on connection change
  };

  const goBackToConnection = () => {
    setCurrentPage('connection');
  };

  // Function to handle direct query execution
  const handleExecuteQuery = async (query: string) => {
    if (!query.trim() || isExecuting) return;

    setIsExecuting(true);
    setCurrentQuery(query);

    try {
      console.log('🚀 [App] Executing query:', query);
      const result = await DatabaseService.executeQuery(query);
      console.log('🚀 [App] Query executed successfully:', result);
      setQueryResult(result);
    } catch (error) {
      console.error('🚨 [App] Error executing query:', error);
      setQueryResult(null);
    } finally {
      setIsExecuting(false);
    }
  };

  // Function to handle table selection and execute quick query automatically
  const handleTableSelect = async (tableName: string, schemaName: string = 'public', page: number = 1, pageSize: number = 100) => {
    console.log('🚀 [App] handleTableSelect called with:', {
      tableName,
      schemaName,
      page,
      pageSize,
      connectionStatus: connectionStatus?.connected
    });

    // Clear related tables when selecting a new main table
    setRelatedTableResults([]);

    // Store current table info for editing
    setCurrentTable({ name: tableName, schema: schemaName });

    const offset = (page - 1) * pageSize;
    const query = `SELECT * FROM "${schemaName}"."${tableName}" LIMIT ${pageSize} OFFSET ${offset};`;
    console.log('🚀 [App] Generated query:', query);

    setCurrentQuery(query);

    // Execute the query automatically
    console.log('🚀 [App] Starting query execution...');
    setIsExecuting(true);

    try {
      // Execute ultra-optimized query that handles empty tables in one call
      console.log('🚀 [App] Executing ultra-optimized paginated query...');

      // Fallback to simpler approach for better compatibility
      const simpleOptimizedQuery = `
        SELECT *, COUNT(*) OVER() as total_count 
        FROM "${schemaName}"."${tableName}" 
        LIMIT ${pageSize} OFFSET ${offset};
      `;

      let result;
      let totalRows = 0;

      try {
        result = await DatabaseService.executeQuery(simpleOptimizedQuery);

        if (result.rows.length > 0) {
          // The total_count is in the last column of each row
          totalRows = result.rows[0][result.rows[0].length - 1] || 0;

          // Remove the total_count column from all rows
          result.rows = result.rows.map(row => row.slice(0, -1));
          result.columns = result.columns.slice(0, -1);
        } else {
          // For empty tables, we need the count - use a cached approach
          const cacheKey = `${schemaName}.${tableName}`;
          const cachedCount = tableRowCounts.get(cacheKey);

          if (cachedCount !== undefined) {
            totalRows = cachedCount;
          } else {
            // Only query if not cached
            const countQuery = `SELECT COUNT(*) as total FROM "${schemaName}"."${tableName}";`;
            const countResult = await DatabaseService.executeQuery(countQuery);
            totalRows = countResult.rows[0]?.[0] || 0;
          }
        }
      } catch (error) {
        console.warn('Optimized query failed, using fallback:', error);
        // Fallback to separate queries if the optimized one fails
        result = await DatabaseService.executeQuery(`SELECT * FROM "${schemaName}"."${tableName}" LIMIT ${pageSize} OFFSET ${offset};`);
        const countResult = await DatabaseService.executeQuery(`SELECT COUNT(*) as total FROM "${schemaName}"."${tableName}";`);
        totalRows = countResult.rows[0]?.[0] || 0;
      }

      // Add pagination info to result
      const paginatedResult = {
        ...result,
        pagination: {
          current_page: page,
          page_size: pageSize,
          total_rows: totalRows,
          has_more: (page * pageSize) < totalRows
        }
      };

      console.log('🚀 [App] Query executed successfully:', {
        rowsAffected: result.rows_affected,
        executionTime: result.execution_time_ms,
        columnsCount: result.columns.length,
        rowsCount: result.rows.length,
        totalRows,
        page,
        pageSize,
        firstRow: result.rows[0] || 'No rows'
      });

      setQueryResult(paginatedResult);

      // Update the row count cache
      updateTableRowCount(tableName, schemaName, totalRows);

      console.log(`✅ Query executed for table ${schemaName}.${tableName}: ${result.rows.length} of ${totalRows} rows returned in ${result.execution_time_ms}ms`);



      // Show success toast for quick query
      console.log(`Quick query executed for table ${schemaName}.${tableName}: ${result.rows_affected} rows returned in ${result.execution_time_ms}ms`);
    } catch (error) {
      console.error('🚨 [App] Error executing quick table query:', error);
      console.error('🚨 [App] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      setQueryResult(null);
    } finally {
      console.log('🚀 [App] Query execution finished, setting isExecuting to false');
      setIsExecuting(false);
    }
  };

  // Function to handle opening related tables with specific filter
  const handleOpenRelatedTable = async (tableName: string, schemaName: string, foreignKeyValue: any, columnName: string) => {
    console.log('🔗 [App] handleOpenRelatedTable called with:', {
      tableName,
      schemaName,
      foreignKeyValue,
      columnName,
      currentTable: currentTable?.name,
      currentRelatedTables: relatedTableResults.length
    });

    // Check if this related table is already open
    const existingIndex = relatedTableResults.findIndex(
      rt => rt.tableName === tableName &&
        rt.schemaName === schemaName &&
        rt.filterInfo.columnName === columnName &&
        rt.filterInfo.value === foreignKeyValue
    );

    if (existingIndex !== -1) {
      console.log('🔗 [App] Related table already open, not opening again');
      return;
    }

    // Execute the filtered query
    console.log('🔗 [App] Starting filtered query execution...');

    try {
      // Check connection status before executing query
      const isConnected = await DatabaseService.isConnected();
      if (!isConnected) {
        throw new Error('Database is not connected');
      }

      // Build the actual query with the parameter value
      let actualQuery: string;
      if (typeof foreignKeyValue === 'string') {
        actualQuery = `SELECT * FROM "${schemaName}"."${tableName}" WHERE "${columnName}" = '${foreignKeyValue}' LIMIT 100;`;
      } else if (foreignKeyValue === null) {
        actualQuery = `SELECT * FROM "${schemaName}"."${tableName}" WHERE "${columnName}" IS NULL LIMIT 100;`;
      } else {
        actualQuery = `SELECT * FROM "${schemaName}"."${tableName}" WHERE "${columnName}" = ${foreignKeyValue} LIMIT 100;`;
      }

      console.log('🔗 [App] Executing actual query:', actualQuery);
      const result = await DatabaseService.executeQuery(actualQuery);

      console.log('🔗 [App] Filtered query executed successfully:', {
        rowsAffected: result.rows_affected,
        executionTime: result.execution_time_ms,
        columnsCount: result.columns.length,
        rowsCount: result.rows.length
      });

      // Add the related table result to the list
      const newRelatedTable = {
        tableName,
        schemaName,
        queryResult: result,
        filterInfo: {
          columnName,
          value: foreignKeyValue,
          parentTable: currentTable?.name || 'unknown'
        }
      };

      setRelatedTableResults(prev => [...prev, newRelatedTable]);
      console.log(`✅ Related table added: ${schemaName}.${tableName} where ${columnName} = ${foreignKeyValue}: ${result.rows.length} rows returned in ${result.execution_time_ms}ms`);
    } catch (error) {
      console.error('🚨 [App] Error executing related table query:', error);
    }
  };

  // Function to close a related table
  const handleCloseRelatedTable = (index: number) => {
    setRelatedTableResults(prev => prev.filter((_, i) => i !== index));
  };

  // Function to clear all related tables
  const handleClearRelatedTables = () => {
    setRelatedTableResults([]);
  };

  const handleQueryResult = (result: QueryResult | null) => {
    setQueryResult(result);
  };

  const handleQueryExecuting = (executing: boolean) => {
    setIsExecuting(executing);
  };

  // Pagination functions removed - not needed without editing functionality

  // Function to update table row count
  const updateTableRowCount = (tableName: string, schemaName: string, rowCount: number) => {
    const key = `${schemaName}.${tableName}`;
    setTableRowCounts(prev => new Map(prev.set(key, rowCount)));
  };

  useEffect(() => {
    // Get initial connection status
    refreshConnectionStatus();

    // Set up periodic status check (much less frequent)
    const statusInterval = setInterval(() => {
      if (currentPage === 'schema') {
        // Only check status when on schema page and much less frequently
        refreshConnectionStatus(false); // Don't force, respect cache
      }
    }, 30000); // Check every 30 seconds instead of 10

    return () => clearInterval(statusInterval);
  }, [currentPage]);

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'connection':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">Paso 1: Conexión a la Base de Datos</h2>
              <p className="text-gray-400">Configura tu conexión a PostgreSQL para continuar</p>
            </div>
            <ConnectionManager
              onConnectionChange={handleConnectionChange}
              onNavigateToSchema={() => setCurrentPage('schema')}
            />
          </div>
        );

      case 'profiles':
        return (
          <div className="max-w-full mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Connection Profile Manager</h2>
                <p className="text-gray-400">Manage your database connection profiles</p>
              </div>
              <Button
                variant="outline"
                onClick={goBackToConnection}
                className="flex items-center space-x-2 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Connection</span>
              </Button>
            </div>
            <ConnectionProfileManagerDemo />
          </div>
        );

      case 'schema':
        return (
          <div className="max-w-full mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Paso 2: Explorador de Esquemas</h2>
                <p className="text-gray-400">Selecciona una tabla para ver automáticamente sus datos</p>
              </div>
              <Button
                variant="outline"
                onClick={goBackToConnection}
                className="flex items-center space-x-2 border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-500"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Volver a Conexión</span>
              </Button>
            </div>

            {/* Layout de dos columnas */}
            <div className="grid grid-cols-12 gap-6 min-h-[calc(100vh-200px)]">
              {/* Columna izquierda - Schema Explorer (más pequeña) */}
              <div className="col-span-3 min-w-[300px]">
                <SchemaExplorer
                  isConnected={connectionStatus?.connected || false}
                  onTableSelect={handleTableSelect}
                  tableRowCounts={tableRowCounts}
                />
              </div>

              {/* Columna derecha - Query Editor y Results (más grande) */}
              <div className="col-span-9 space-y-4 min-w-0">
                {/* Query Editor colapsible */}
                <div className="bg-gray-800/90 backdrop-blur-sm border border-gray-700/50 rounded-lg">
                  <div className="flex items-center justify-between p-4 border-b border-gray-700/50">
                    <h3 className="text-lg font-semibold text-white">SQL Query Editor</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsQueryEditorCollapsed(!isQueryEditorCollapsed)}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      {isQueryEditorCollapsed ? 'Expand' : 'Collapse'}
                    </Button>
                  </div>
                  {!isQueryEditorCollapsed && (
                    <div className="p-4">
                      <QueryEditor
                        isConnected={connectionStatus?.connected || false}
                        onQueryResult={handleQueryResult}
                        onQueryExecuting={handleQueryExecuting}
                        initialQuery={currentQuery}
                      />
                    </div>
                  )}
                </div>

                {/* Results Viewer - siempre visible y prominente */}
                <div className="space-y-4">
                  {/* Main table results */}
                  <ResultsViewer
                    queryResult={queryResult}
                    isLoading={isExecuting}
                    tableName={currentTable?.name}
                    schemaName={currentTable?.schema}
                    enableEditing={true}
                    onQueryResultUpdate={setQueryResult}
                    onOpenRelatedTable={handleOpenRelatedTable}
                  />

                  {/* Related tables section */}
                  {relatedTableResults.length > 0 && (
                    <div className="space-y-4">
                      {/* Header for related tables */}
                      <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                        <div className="flex items-center space-x-2">
                          <Layers className="h-5 w-5 text-purple-400" />
                          <h3 className="text-lg font-semibold text-white">Related Tables</h3>
                          <Badge variant="secondary" className="text-xs">
                            {relatedTableResults.length}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleClearRelatedTables}
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Clear All
                        </Button>
                      </div>

                      {/* Related table results */}
                      {relatedTableResults.map((relatedTable, index) => (
                        <div key={`${relatedTable.tableName}-${relatedTable.schemaName}-${index}`} className="relative">
                          {/* Related table header */}
                          <div className="flex items-center justify-between p-3 bg-blue-900/20 border border-blue-500/30 rounded-t-lg">
                            <div className="flex items-center space-x-2">
                              <ExternalLink className="h-4 w-4 text-blue-400" />
                              <span className="text-blue-300 font-medium">
                                {relatedTable.schemaName}.{relatedTable.tableName}
                              </span>
                              <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-300">
                                {relatedTable.filterInfo.columnName} = {String(relatedTable.filterInfo.value)}
                              </Badge>
                              <span className="text-xs text-gray-400">
                                from {relatedTable.filterInfo.parentTable}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCloseRelatedTable(index)}
                              className="h-6 w-6 p-0 text-gray-400 hover:text-gray-300 hover:bg-gray-700"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Related table content */}
                          <div className="border-l border-r border-b border-blue-500/30 rounded-b-lg">
                            <ResultsViewer
                              queryResult={relatedTable.queryResult}
                              isLoading={false}
                              tableName={relatedTable.tableName}
                              schemaName={relatedTable.schemaName}
                              enableEditing={true}
                              onQueryResultUpdate={(updatedResult) => {
                                if (updatedResult) {
                                  setRelatedTableResults(prev =>
                                    prev.map((rt, i) =>
                                      i === index ? { ...rt, queryResult: updatedResult } : rt
                                    )
                                  );
                                }
                              }}
                              onOpenRelatedTable={handleOpenRelatedTable}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="dark min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800">
      {/* Header */}
      <header className="bg-gray-800/95 backdrop-blur border-b border-gray-700/50 shadow-sm">
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center space-x-3">
            <Database className="h-8 w-8 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">
              PostgreSQL Query Tool
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Navigation */}
            <div className="flex items-center space-x-2 text-sm">
              <Button
                variant={currentPage === 'connection' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentPage('connection')}
                className="text-xs"
              >
                Connection
              </Button>
              <Button
                variant={currentPage === 'profiles' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentPage('profiles')}
                className="text-xs"
              >
                <Settings className="h-3 w-3 mr-1" />
                Profiles
              </Button>
              <Button
                variant={currentPage === 'schema' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentPage('schema')}
                className="text-xs"
                disabled={!connectionStatus?.connected}
              >
                Schema
              </Button>
            </div>

            {/* Estado de conexión */}
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
                  {connectionStatus.connected ? 'Conectado' : 'Desconectado'}
                </Badge>
              </div>
            )}

            {/* Help Button */}
            <Tooltip content="Show help and keyboard shortcuts (F1)">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHelpDialog(true)}
                className="text-gray-300 hover:text-white hover:bg-gray-700/50"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-none mx-auto p-6">
        {renderCurrentPage()}
      </main>

      {/* Help Dialog */}
      <HelpDialog
        open={showHelpDialog}
        onOpenChange={setShowHelpDialog}
      />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppContent />
        <ToastContainer />
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
