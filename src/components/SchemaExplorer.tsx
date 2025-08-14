import React, { useState, useEffect } from "react";
import {
  Database,
  Table,
  ChevronRight,
  ChevronDown,
  Key,
  Link,
  Hash,
  Info,
  Layers,
  BarChart3,
  RefreshCw,
  Play,
  Star,
  FileText,
  // FileJson, FileCode removed - not used anymore
  Eye,
  Plus,
  Code
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
// DropdownMenu imports removed as we now use ExportDialog
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TableInfo,
  ColumnInfo,
  IndexInfo,
  ForeignKeyInfo,
  DatabaseStatistics,
  // Export types removed as we now use ExportDialog
  ViewInfo,
  StoredProcedureInfo,
  MaterializedViewInfo,
  CreateIndexOptions
} from "@/types/database";
import { DatabaseService } from "@/services/database";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { errorToString } from "@/utils/error";
import Tooltip from "./Tooltip";
// save import removed as we now use ExportDialog
import ExportDialog from './ExportDialog';

interface SchemaExplorerProps {
  isConnected: boolean;
  onTableSelect?: (tableName: string, schemaName?: string) => void;
  tableRowCounts?: Map<string, number>;
}

interface ExpandedSections {
  [key: string]: {
    columns: boolean;
    indexes: boolean;
    foreignKeys: boolean;
  };
}

export default function SchemaExplorer({ isConnected, onTableSelect, tableRowCounts }: SchemaExplorerProps) {
  const { addToast } = useToast();
  
  console.log('🔍 [SchemaExplorer] Component rendered with:', {
    isConnected,
    onTableSelectExists: !!onTableSelect
  });

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoadingTables, setIsLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<ExpandedSections>({});

  const [tableColumns, setTableColumns] = useState<{ [key: string]: ColumnInfo[] }>({});
  const [tableIndexes, setTableIndexes] = useState<{ [key: string]: IndexInfo[] }>({});
  const [tableForeignKeys, setTableForeignKeys] = useState<{ [key: string]: ForeignKeyInfo[] }>({});
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: { [key: string]: boolean } }>({});

  const [databaseStats, setDatabaseStats] = useState<DatabaseStatistics | null>(null);
  const [favoriteTables, setFavoriteTables] = useState<Set<string>>(new Set());
  const [connectionId, setConnectionId] = useState<string | null>(null);

  // New state for views, stored procedures, and materialized views
  const [views, setViews] = useState<ViewInfo[]>([]);
  const [storedProcedures, setStoredProcedures] = useState<StoredProcedureInfo[]>([]);
  const [materializedViews, setMaterializedViews] = useState<MaterializedViewInfo[]>([]);
  const [isLoadingViews, setIsLoadingViews] = useState(false);
  const [isLoadingProcedures, setIsLoadingProcedures] = useState(false);
  const [isLoadingMaterializedViews, setIsLoadingMaterializedViews] = useState(false);
  const [activeTab, setActiveTab] = useState<'tables' | 'views' | 'procedures' | 'reports'>('tables');

  const loadTables = async () => {
    if (!isConnected) {
      return;
    }

    setIsLoadingTables(true);
    try {
      const tablesData = await DatabaseService.getTables();
      setTables(tablesData);
      
      // Show success toast when tables are loaded automatically
      if (tablesData.length > 0) {
        addToast({
          type: 'success',
          title: 'Tables Loaded',
          message: `Found ${tablesData.length} table${tablesData.length !== 1 ? 's' : ''} in the database`,
        });
      }
    } catch (error) {
      console.error("Failed to load tables:", error);
      setTables([]);
      addToast({
        type: 'error',
        title: 'Failed to Load Tables',
        message: errorToString(error),
      });
    } finally {
      setIsLoadingTables(false);
    }
  };

  // Function to load row counts for all tables in a single ultra-optimized query
  const loadAllRowCounts = async () => {
    if (!isConnected || tables.length === 0) {
      return;
    }

    try {
      // Filter tables that need row counts, considering cached values
      const tablesToCount = tables.filter(table => {
        const key = `${table.schema || 'public'}.${table.name}`;
        const cachedCount = tableRowCounts?.get(key);
        return cachedCount === undefined && (table.row_count === undefined || table.row_count < 0);
      });

      if (tablesToCount.length === 0) {
        console.log('🔍 [SchemaExplorer] All tables already have row counts (cached or loaded)');
        return;
      }

      // Use PostgreSQL's information_schema for a more efficient approach when possible
      const useInformationSchema = tablesToCount.length > 10; // Use for many tables
      
      let result;
      let countMap = new Map();

      if (useInformationSchema) {
        console.log('🔍 [SchemaExplorer] Using information_schema approach for', tablesToCount.length, 'tables');
        
        // Try to get approximate row counts from pg_class (much faster for large tables)
        const tableNames = tablesToCount.map(t => `'${t.name}'`).join(',');
        const schemaNames = [...new Set(tablesToCount.map(t => t.schema || 'public'))].map(s => `'${s}'`).join(',');
        
        const statsQuery = `
          SELECT 
            schemaname as schema_name,
            tablename as table_name,
            n_tup_ins - n_tup_del as row_count
          FROM pg_stat_user_tables 
          WHERE schemaname IN (${schemaNames}) 
            AND tablename IN (${tableNames})
            AND n_tup_ins > 0;
        `;
        
        try {
          result = await DatabaseService.executeQuery(statsQuery);
          result.rows.forEach(row => {
            const [schemaName, tableName, rowCount] = row;
            countMap.set(`${schemaName}.${tableName}`, Math.max(0, rowCount || 0));
          });
          
          // For tables not in pg_stat_user_tables, fall back to COUNT(*)
          const missingTables = tablesToCount.filter(table => {
            const key = `${table.schema || 'public'}.${table.name}`;
            return !countMap.has(key);
          });
          
          if (missingTables.length > 0) {
            console.log('🔍 [SchemaExplorer] Falling back to COUNT(*) for', missingTables.length, 'tables');
            const countQueries = missingTables.map(table => 
              `SELECT '${table.name}' as table_name, '${table.schema || 'public'}' as schema_name, COUNT(*) as row_count FROM "${table.schema || 'public'}"."${table.name}"`
            );
            const unionQuery = countQueries.join(' UNION ALL ');
            const fallbackResult = await DatabaseService.executeQuery(unionQuery);
            
            fallbackResult.rows.forEach(row => {
              const [tableName, schemaName, rowCount] = row;
              countMap.set(`${schemaName}.${tableName}`, rowCount);
            });
          }
        } catch (error) {
          console.warn('Stats query failed, falling back to COUNT(*):', error);
          throw error; // Fall through to the COUNT(*) approach
        }
      } else {
        // Use the original UNION ALL approach for fewer tables
        console.log('🔍 [SchemaExplorer] Using COUNT(*) approach for', tablesToCount.length, 'tables');
        const countQueries = tablesToCount.map(table => 
          `SELECT '${table.name}' as table_name, '${table.schema || 'public'}' as schema_name, COUNT(*) as row_count FROM "${table.schema || 'public'}"."${table.name}"`
        );

        const unionQuery = countQueries.join(' UNION ALL ');
        result = await DatabaseService.executeQuery(unionQuery);
        
        result.rows.forEach(row => {
          const [tableName, schemaName, rowCount] = row;
          countMap.set(`${schemaName}.${tableName}`, rowCount);
        });
      }

      // Update tables with the new row counts
      setTables(prevTables => 
        prevTables.map(table => {
          const key = `${table.schema || 'public'}.${table.name}`;
          const newRowCount = countMap.get(key);
          return newRowCount !== undefined 
            ? { ...table, row_count: newRowCount }
            : table;
        })
      );

      console.log('✅ [SchemaExplorer] Updated row counts for', countMap.size, 'tables');
    } catch (error) {
      console.warn('Failed to load row counts:', error);
    }
  };



  const loadDatabaseStats = async () => {
    if (!isConnected) {
      return;
    }

    try {
      const stats = await DatabaseService.getDatabaseStatistics();
      setDatabaseStats(stats);
    } catch (error) {
      console.error("Failed to load database statistics:", error);
      setDatabaseStats(null);
    }
  };

  const loadViews = async () => {
    if (!isConnected) {
      return;
    }

    setIsLoadingViews(true);
    try {
      const viewsData = await DatabaseService.getViews();
      setViews(viewsData);
      
      if (viewsData.length > 0) {
        addToast({
          type: 'success',
          title: 'Views Loaded',
          message: `Found ${viewsData.length} view${viewsData.length !== 1 ? 's' : ''} in the database`,
        });
      }
    } catch (error) {
      console.error("Failed to load views:", error);
      setViews([]);
      addToast({
        type: 'error',
        title: 'Failed to Load Views',
        message: errorToString(error),
      });
    } finally {
      setIsLoadingViews(false);
    }
  };

  const loadStoredProcedures = async () => {
    if (!isConnected) {
      return;
    }

    setIsLoadingProcedures(true);
    try {
      const proceduresData = await DatabaseService.getStoredProcedures();
      setStoredProcedures(proceduresData);
      
      if (proceduresData.length > 0) {
        addToast({
          type: 'success',
          title: 'Stored Procedures Loaded',
          message: `Found ${proceduresData.length} stored procedure${proceduresData.length !== 1 ? 's' : ''} in the database`,
        });
      }
    } catch (error) {
      console.error("Failed to load stored procedures:", error);
      setStoredProcedures([]);
      addToast({
        type: 'error',
        title: 'Failed to Load Stored Procedures',
        message: errorToString(error),
      });
    } finally {
      setIsLoadingProcedures(false);
    }
  };

  const loadMaterializedViews = async () => {
    if (!isConnected) {
      return;
    }

    setIsLoadingMaterializedViews(true);
    try {
      const materializedViewsData = await DatabaseService.getMaterializedViews();
      setMaterializedViews(materializedViewsData);
      
      if (materializedViewsData.length > 0) {
        addToast({
          type: 'success',
          title: 'Materialized Views Loaded',
          message: `Found ${materializedViewsData.length} materialized view${materializedViewsData.length !== 1 ? 's' : ''} in the database`,
        });
      }
    } catch (error) {
      console.error("Failed to load materialized views:", error);
      setMaterializedViews([]);
      addToast({
        type: 'error',
        title: 'Failed to Load Materialized Views',
        message: errorToString(error),
      });
    } finally {
      setIsLoadingMaterializedViews(false);
    }
  };

  const loadTableColumns = async (tableName: string, schemaName?: string) => {
    const tableKey = `${schemaName || 'public'}.${tableName}`;

    console.log(`Loading columns for table: ${tableName}, schema: ${schemaName || 'public'}`);

    setLoadingStates(prev => ({
      ...prev,
      [tableKey]: { ...prev[tableKey], columns: true }
    }));

    try {
      const columns = await DatabaseService.getTableColumns(tableName, schemaName);
      console.log(`Loaded ${columns.length} columns for ${tableKey}:`, columns);
      setTableColumns(prev => ({ ...prev, [tableKey]: columns }));
    } catch (error) {
      console.error("Failed to load table columns:", error);
      addToast({
        type: 'error',
        title: 'Failed to Load Columns',
        message: errorToString(error),
      });
    } finally {
      setLoadingStates(prev => ({
        ...prev,
        [tableKey]: { ...prev[tableKey], columns: false }
      }));
    }
  };

  const loadTableIndexes = async (tableName: string, schemaName?: string) => {
    const tableKey = `${schemaName || 'public'}.${tableName}`;

    console.log(`Loading indexes for table: ${tableName}, schema: ${schemaName || 'public'}`);

    setLoadingStates(prev => ({
      ...prev,
      [tableKey]: { ...prev[tableKey], indexes: true }
    }));

    try {
      const indexes = await DatabaseService.getTableIndexes(tableName, schemaName);
      console.log(`Loaded ${indexes.length} indexes for ${tableKey}:`, indexes);
      setTableIndexes(prev => ({ ...prev, [tableKey]: indexes }));
    } catch (error) {
      console.error("Failed to load table indexes:", error);
      addToast({
        type: 'error',
        title: 'Failed to Load Indexes',
        message: errorToString(error),
      });
      setTableIndexes(prev => ({ ...prev, [tableKey]: [] }));
    } finally {
      setLoadingStates(prev => ({
        ...prev,
        [tableKey]: { ...prev[tableKey], indexes: false }
      }));
    }
  };

  const loadTableForeignKeys = async (tableName: string, schemaName?: string) => {
    const tableKey = `${schemaName || 'public'}.${tableName}`;

    console.log(`Loading foreign keys for table: ${tableName}, schema: ${schemaName || 'public'}`);

    setLoadingStates(prev => ({
      ...prev,
      [tableKey]: { ...prev[tableKey], foreignKeys: true }
    }));

    try {
      const foreignKeys = await DatabaseService.getTableForeignKeys(tableName, schemaName);
      console.log(`Loaded ${foreignKeys.length} foreign keys for ${tableKey}:`, foreignKeys);
      setTableForeignKeys(prev => ({ ...prev, [tableKey]: foreignKeys }));
    } catch (error) {
      console.error("Failed to load table foreign keys:", error);
      addToast({
        type: 'error',
        title: 'Failed to Load Foreign Keys',
        message: errorToString(error),
      });
      setTableForeignKeys(prev => ({ ...prev, [tableKey]: [] }));
    } finally {
      setLoadingStates(prev => ({
        ...prev,
        [tableKey]: { ...prev[tableKey], foreignKeys: false }
      }));
    }
  };

  const handleTableClick = (table: TableInfo) => {
    console.log('🔍 [SchemaExplorer] Table clicked:', {
      tableName: table.name,
      schema: table.schema,
      tableInfo: table
    });
    
    const tableKey = `${table.schema}.${table.name}`;
    setSelectedTable(selectedTable === tableKey ? null : tableKey);
    
    console.log('🔍 [SchemaExplorer] Calling onTableSelect with:', {
      tableName: table.name,
      schemaName: table.schema,
      onTableSelectExists: !!onTableSelect
    });
    
    // Always call onTableSelect when a table is clicked to trigger quick query
    onTableSelect?.(table.name, table.schema);
  };

  const toggleSection = async (table: TableInfo, section: 'columns' | 'indexes' | 'foreignKeys') => {
    const tableKey = `${table.schema}.${table.name}`;
    const isExpanded = expandedSections[tableKey]?.[section] || false;

    setExpandedSections(prev => ({
      ...prev,
      [tableKey]: {
        ...prev[tableKey],
        [section]: !isExpanded
      }
    }));

    // Load data if expanding and not already loaded
    if (!isExpanded) {
      switch (section) {
        case 'columns':
          if (!tableColumns[tableKey]) {
            await loadTableColumns(table.name, table.schema);
          }
          break;
        case 'indexes':
          if (!tableIndexes[tableKey]) {
            await loadTableIndexes(table.name, table.schema);
          }
          break;
        case 'foreignKeys':
          if (!tableForeignKeys[tableKey]) {
            await loadTableForeignKeys(table.name, table.schema);
          }
          break;
      }
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Generate a unique connection ID based on connection info
  const generateConnectionId = async (): Promise<string> => {
    try {
      const connectionInfo = await DatabaseService.getConnectionInfo();
      if (connectionInfo) {
        return `${connectionInfo.host}_${connectionInfo.database}_${connectionInfo.username}`;
      }
    } catch (error) {
      console.error('Failed to get connection info:', error);
    }
    return 'default_connection';
  };

  // Load favorites from localStorage for current connection
  const loadFavorites = async () => {
    const connId = await generateConnectionId();
    setConnectionId(connId);
    
    const favoritesKey = `favorites_${connId}`;
    const savedFavorites = localStorage.getItem(favoritesKey);
    
    if (savedFavorites) {
      try {
        const parsed = JSON.parse(savedFavorites);
        setFavoriteTables(new Set(parsed));
      } catch (error) {
        console.error('Failed to load favorites:', error);
        setFavoriteTables(new Set());
      }
    } else {
      setFavoriteTables(new Set());
    }
  };

  // Save favorites to localStorage
  const saveFavorites = (favorites: Set<string>) => {
    if (connectionId) {
      const favoritesKey = `favorites_${connectionId}`;
      localStorage.setItem(favoritesKey, JSON.stringify(Array.from(favorites)));
    }
  };

  // Toggle favorite status for a table
  const toggleFavorite = (table: TableInfo, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent table selection when clicking star
    
    const tableKey = `${table.schema}.${table.name}`;
    const newFavorites = new Set(favoriteTables);
    
    if (newFavorites.has(tableKey)) {
      newFavorites.delete(tableKey);
      addToast({
        type: 'info',
        title: 'Removed from Favorites',
        message: `${table.name} removed from favorites`,
      });
    } else {
      newFavorites.add(tableKey);
      addToast({
        type: 'success',
        title: 'Added to Favorites',
        message: `${table.name} added to favorites`,
      });
    }
    
    setFavoriteTables(newFavorites);
    saveFavorites(newFavorites);
  };

  // Check if a table is favorite
  const isFavorite = (table: TableInfo): boolean => {
    const tableKey = `${table.schema}.${table.name}`;
    return favoriteTables.has(tableKey);
  };

  // Handle create index
  const handleCreateIndex = async (table: TableInfo) => {
    try {
      // For now, show a simple prompt for index creation
      // In a real implementation, you'd want a proper dialog
      const indexName = prompt(`Enter index name for table ${table.name}:`);
      if (!indexName) return;

      const columnName = prompt(`Enter column name to index (comma-separated for multiple columns):`);
      if (!columnName) return;

      const isUnique = confirm('Should this be a unique index?');

      const columns = columnName.split(',').map(col => col.trim());

      const indexOptions: CreateIndexOptions = {
        name: indexName,
        table_name: table.name,
        schema_name: table.schema,
        columns,
        is_unique: isUnique,
        index_type: 'btree', // Default to btree
      };

      addToast({
        type: 'info',
        title: 'Creating Index',
        message: `Creating index ${indexName} on ${table.name}...`,
      });

      const result = await DatabaseService.createIndex(indexOptions);
      
      addToast({
        type: 'success',
        title: 'Index Created',
        message: result,
      });

      // Reload indexes for this table
      await loadTableIndexes(table.name, table.schema);
    } catch (error) {
      console.error('Failed to create index:', error);
      addToast({
        type: 'error',
        title: 'Failed to Create Index',
        message: errorToString(error),
      });
    }
  };

  // Handle table export
  // Table export is now handled by ExportDialog component

  // Sort tables with favorites first
  const sortedTables = [...tables].sort((a, b) => {
    const aIsFavorite = isFavorite(a);
    const bIsFavorite = isFavorite(b);
    
    if (aIsFavorite && !bIsFavorite) return -1;
    if (!aIsFavorite && bIsFavorite) return 1;
    
    // If both are favorites or both are not, sort by name
    return a.name.localeCompare(b.name);
  });

  useEffect(() => {
    if (isConnected) {
      // Auto-load tables and database stats when connection is established
      loadTables();
      loadDatabaseStats();
      loadFavorites();
      loadViews();
      loadStoredProcedures();
      loadMaterializedViews();
    } else {
      // Clear all data when disconnected
      setTables([]);
      setDatabaseStats(null);
      setSelectedTable(null);
      setExpandedSections({});
      setTableColumns({});
      setTableIndexes({});
      setTableForeignKeys({});
      setLoadingStates({});
      setFavoriteTables(new Set());
      setConnectionId(null);
      setViews([]);
      setStoredProcedures([]);
      setMaterializedViews([]);
      setActiveTab('tables');
    }
  }, [isConnected]);

  if (!isConnected) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card className="bg-gray-800/90 backdrop-blur-sm border-gray-700/50 shadow-xl">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Database className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Connect to database to explore schema</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none mx-auto space-y-4">
      {/* Database Statistics - Compact horizontal layout */}
      {databaseStats && (
        <Card className="bg-gray-800/90 backdrop-blur-sm border-gray-700/50 shadow-xl">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-blue-400" />
                <span className="text-lg font-semibold text-white">Database Overview</span>
              </div>
              <div className="flex items-center space-x-6">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-400">
                    {formatBytes(databaseStats.database_size)}
                  </div>
                  <div className="text-xs text-gray-400">Size</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">
                    {databaseStats.table_count}
                  </div>
                  <div className="text-xs text-gray-400">Tables</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-400">
                    {databaseStats.index_count}
                  </div>
                  <div className="text-xs text-gray-400">Indexes</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-yellow-400">
                    {databaseStats.schema_count}
                  </div>
                  <div className="text-xs text-gray-400">Schemas</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schema Explorer with Tabs */}
      <div className="w-full">
        <Card className="bg-gray-800/90 backdrop-blur-sm border-gray-700/50 shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center space-x-2 text-lg text-white">
              <Database className="h-5 w-5 text-purple-400" />
              <span>Database Schema</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-gray-700/50">
                <TabsTrigger value="tables" className="flex items-center space-x-2">
                  <Table className="h-4 w-4" />
                  <span>Tables ({tables.length})</span>
                </TabsTrigger>
                <TabsTrigger value="views" className="flex items-center space-x-2">
                  <Eye className="h-4 w-4" />
                  <span>Views ({views.length})</span>
                </TabsTrigger>
                <TabsTrigger value="procedures" className="flex items-center space-x-2">
                  <Code className="h-4 w-4" />
                  <span>Procedures ({storedProcedures.length})</span>
                </TabsTrigger>
                <TabsTrigger value="reports" className="flex items-center space-x-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>Reports ({materializedViews.length})</span>
                </TabsTrigger>
              </TabsList>

              {/* Tables Tab */}
              <TabsContent value="tables" className="mt-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">
                      {tables.length} table{tables.length !== 1 ? 's' : ''}
                    </span>
                    {favoriteTables.size > 0 && (
                      <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                        <Star className="h-3 w-3 mr-1 fill-current" />
                        {favoriteTables.size} favorite{favoriteTables.size !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {isLoadingTables && (
                      <LoadingSpinner size="sm" text="Loading..." className="text-xs text-blue-400" />
                    )}
                    <Tooltip content="Refresh table list (F5)">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadTables}
                        disabled={!isConnected || isLoadingTables}
                        className="h-8 w-8 p-0"
                      >
                        <RefreshCw className={`h-4 w-4 ${isLoadingTables ? 'animate-spin' : ''}`} />
                      </Button>
                    </Tooltip>
                    <Tooltip content="Load row counts for all tables">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadAllRowCounts}
                        disabled={!isConnected || isLoadingTables || tables.length === 0}
                        className="h-8 w-8 p-0"
                      >
                        <Hash className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                {isLoadingTables ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner text="Loading database schema..." />
                </div>
              ) : tables.length === 0 ? (
                <Alert className="glass-effect border-yellow-500/20 bg-yellow-500/10">
                  <Info className="h-4 w-4 text-yellow-400" />
                  <AlertDescription className="text-yellow-300">
                    No tables found in the database.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {sortedTables.map((table) => {
                    const tableKey = `${table.schema}.${table.name}`;
                    const isSelected = selectedTable === tableKey;
                    const sections = expandedSections[tableKey] || { columns: false, indexes: false, foreignKeys: false };
                    const loading = loadingStates[tableKey] || { columns: false, indexes: false, foreignKeys: false };

                    return (
                      <div key={tableKey} className="border border-gray-700 rounded-lg overflow-hidden">
                        {/* Table Header */}
                        <div
                          className={`p-2 cursor-pointer transition-colors ${isSelected ? 'bg-gray-700/50' : 'bg-gray-800/50 hover:bg-gray-700/30'
                            } border-l-2 ${isSelected ? 'border-l-green-400' : 'border-l-transparent hover:border-l-blue-400'}`}
                          onClick={() => handleTableClick(table)}
                          title={`Click to execute: SELECT * FROM ${table.schema}.${table.name} LIMIT 100`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                              {isSelected ? (
                                <ChevronDown className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              )}
                              <Table className="h-3 w-3 text-green-400 flex-shrink-0" />
                              <Play className="h-2 w-2 text-blue-400 flex-shrink-0 opacity-60" />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-col">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium text-white text-sm truncate">{table.name}</span>
                                    {isFavorite(table) && (
                                      <Star className="h-3 w-3 text-yellow-400 fill-current flex-shrink-0" />
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-1 mt-1">
                                    {(() => {
                                      const key = `${table.schema || 'public'}.${table.name}`;
                                      const cachedCount = tableRowCounts?.get(key);
                                      const displayCount = cachedCount !== undefined ? cachedCount : table.row_count;
                                      
                                      return displayCount !== undefined && displayCount >= 0 ? (
                                        <span className="text-xs text-gray-400">{displayCount.toLocaleString()} rows</span>
                                      ) : (
                                        <span className="text-xs text-gray-500 cursor-pointer hover:text-gray-400" 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                loadAllRowCounts();
                                              }}
                                              title="Click to load row counts">
                                          ? rows
                                        </span>
                                      );
                                    })()}
                                    {table.schema !== 'public' && (
                                      <Badge variant="outline" className="text-xs border-gray-600 text-gray-400 px-1 py-0">
                                        {table.schema}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              <ExportDialog
                                tableName={table.name}
                                schemaName={table.schema}
                                exportType="table"
                                trigger={
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-gray-600/50 text-gray-500 hover:text-blue-400"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Export table data"
                                  >
                                    <FileText className="h-3 w-3" />
                                  </Button>
                                }
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-6 w-6 p-0 hover:bg-gray-600/50 ${
                                  isFavorite(table) ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'
                                }`}
                                onClick={(e) => toggleFavorite(table, e)}
                                title={isFavorite(table) ? 'Remove from favorites' : 'Add to favorites'}
                              >
                                <Star className={`h-3 w-3 ${isFavorite(table) ? 'fill-current' : ''}`} />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Table Details */}
                        {isSelected && (
                          <div className="border-t border-gray-700 bg-gray-900/30">
                            {/* Columns Section */}
                            <div className="border-b border-gray-700">
                              <Button
                                variant="ghost"
                                className="w-full justify-start p-2 h-auto text-left hover:bg-gray-800/50 text-sm"
                                onClick={() => toggleSection(table, 'columns')}
                              >
                                <div className="flex items-center space-x-2">
                                  {sections.columns ? (
                                    <ChevronDown className="h-3 w-3" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3" />
                                  )}
                                  <Layers className="h-3 w-3 text-blue-400" />
                                  <span>Columns</span>
                                  {loading.columns && <LoadingSpinner size="sm" />}
                                </div>
                              </Button>
                              {sections.columns && (
                                <div className="px-3 pb-2 space-y-1">
                                  {tableColumns[tableKey]?.map((column, index) => (
                                    <div key={index} className="flex items-center justify-between p-1 rounded bg-gray-800/50 text-xs">
                                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                                        <div className="flex items-center space-x-1 flex-shrink-0">
                                          {column.is_primary_key && <Key className="h-2 w-2 text-yellow-400" />}
                                          {column.is_foreign_key && <Link className="h-2 w-2 text-purple-400" />}
                                        </div>
                                        <span className="font-mono text-white truncate">{column.name}</span>
                                      </div>
                                      <div className="flex items-center space-x-1 flex-shrink-0">
                                        <Badge variant="outline" className="text-xs border-gray-600 text-gray-300 px-1 py-0">
                                          {column.data_type}
                                        </Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Indexes Section */}
                            <div className="border-b border-gray-700">
                              <Button
                                variant="ghost"
                                className="w-full justify-start p-2 h-auto text-left hover:bg-gray-800/50 text-sm"
                                onClick={() => toggleSection(table, 'indexes')}
                              >
                                <div className="flex items-center space-x-2">
                                  {sections.indexes ? (
                                    <ChevronDown className="h-3 w-3" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3" />
                                  )}
                                  <Hash className="h-3 w-3 text-green-400" />
                                  <span>Indexes</span>
                                  {loading.indexes && <LoadingSpinner size="sm" />}
                                </div>
                              </Button>
                              {sections.indexes && (
                                <div className="px-3 pb-2 space-y-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-gray-400">
                                      {tableIndexes[tableKey]?.length || 0} index{(tableIndexes[tableKey]?.length || 0) !== 1 ? 'es' : ''}
                                    </span>
                                    <Tooltip content="Create new index">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCreateIndex(table)}
                                        disabled={!isConnected}
                                        className="h-6 w-6 p-0"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </Button>
                                    </Tooltip>
                                  </div>
                                  {tableIndexes[tableKey]?.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">No indexes found</p>
                                  ) : (
                                    tableIndexes[tableKey]?.map((index, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-gray-800/50">
                                        <div className="flex-1">
                                          <div className="flex items-center space-x-2">
                                            <span className="font-mono text-sm text-white">{index.name}</span>
                                            <Badge variant="outline" className="text-xs text-gray-400 border-gray-600">
                                              {index.index_type.toUpperCase()}
                                            </Badge>
                                          </div>
                                          <div className="text-xs text-gray-400 mt-1">
                                            Columns: {index.columns.join(', ')}
                                          </div>
                                          {index.size_bytes && (
                                            <div className="text-xs text-gray-500">
                                              Size: {formatBytes(index.size_bytes)}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                          {index.is_unique && (
                                            <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-400">
                                              UNIQUE
                                            </Badge>
                                          )}
                                          {index.is_primary && (
                                            <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-400">
                                              PRIMARY
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Foreign Keys Section */}
                            <div>
                              <Button
                                variant="ghost"
                                className="w-full justify-start p-2 h-auto text-left hover:bg-gray-800/50 text-sm"
                                onClick={() => toggleSection(table, 'foreignKeys')}
                              >
                                <div className="flex items-center space-x-2">
                                  {sections.foreignKeys ? (
                                    <ChevronDown className="h-3 w-3" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3" />
                                  )}
                                  <Link className="h-3 w-3 text-purple-400" />
                                  <span>Foreign Keys</span>
                                  {loading.foreignKeys && <LoadingSpinner size="sm" />}
                                </div>
                              </Button>
                              {sections.foreignKeys && (
                                <div className="px-3 pb-2 space-y-1">
                                  {tableForeignKeys[tableKey]?.length === 0 ? (
                                    <p className="text-sm text-gray-500 italic">No foreign keys found</p>
                                  ) : (
                                    tableForeignKeys[tableKey]?.map((fk, idx) => (
                                      <div 
                                        key={idx} 
                                        className="flex items-center justify-between p-2 rounded bg-gray-800/50 hover:bg-gray-700/50 cursor-pointer transition-colors"
                                        onClick={() => {
                                          console.log('🔗 [SchemaExplorer] Foreign key clicked:', fk);
                                          // Execute a query to show related data
                                          onTableSelect?.(fk.referenced_table, 'public');
                                        }}
                                        title={`Click to view ${fk.referenced_table} table`}
                                      >
                                        <div>
                                          <span className="font-mono text-sm text-white">{fk.name}</span>
                                          <div className="text-xs text-gray-400">
                                            {fk.column_name} → {fk.referenced_table}.{fk.referenced_column}
                                          </div>
                                        </div>
                                        <Play className="h-3 w-3 text-blue-400" />
                                      </div>
                                    ))
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              </TabsContent>

              {/* Views Tab */}
              <TabsContent value="views" className="mt-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-400">
                    {views.length} view{views.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center space-x-2">
                    {isLoadingViews && (
                      <LoadingSpinner size="sm" text="Loading..." className="text-xs text-blue-400" />
                    )}
                    <Tooltip content="Refresh views list">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadViews}
                        disabled={!isConnected || isLoadingViews}
                        className="h-8 w-8 p-0"
                      >
                        <RefreshCw className={`h-4 w-4 ${isLoadingViews ? 'animate-spin' : ''}`} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                {isLoadingViews ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner text="Loading views..." />
                  </div>
                ) : views.length === 0 ? (
                  <Alert className="glass-effect border-yellow-500/20 bg-yellow-500/10">
                    <Info className="h-4 w-4 text-yellow-400" />
                    <AlertDescription className="text-yellow-300">
                      No views found in the database.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {views.map((view, index) => (
                      <div key={index} className="border border-gray-700 rounded-lg overflow-hidden">
                        <div className="p-3 bg-gray-800/50 hover:bg-gray-700/30 cursor-pointer transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Eye className="h-4 w-4 text-green-400" />
                              <span className="font-medium text-white">{view.name}</span>
                              {view.schema !== 'public' && (
                                <Badge variant="outline" className="text-xs border-gray-600 text-gray-400 px-1 py-0">
                                  {view.schema}
                                </Badge>
                              )}
                              {view.is_updatable && (
                                <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                                  Updatable
                                </Badge>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-gray-600/50 text-gray-500 hover:text-blue-400"
                              onClick={() => onTableSelect?.(view.name, view.schema)}
                              title="Query view"
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="mt-2 text-xs text-gray-400 font-mono bg-gray-900/50 p-2 rounded max-h-20 overflow-y-auto">
                            {view.definition.substring(0, 200)}
                            {view.definition.length > 200 && '...'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Stored Procedures Tab */}
              <TabsContent value="procedures" className="mt-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-400">
                    {storedProcedures.length} procedure{storedProcedures.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center space-x-2">
                    {isLoadingProcedures && (
                      <LoadingSpinner size="sm" text="Loading..." className="text-xs text-blue-400" />
                    )}
                    <Tooltip content="Refresh procedures list">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadStoredProcedures}
                        disabled={!isConnected || isLoadingProcedures}
                        className="h-8 w-8 p-0"
                      >
                        <RefreshCw className={`h-4 w-4 ${isLoadingProcedures ? 'animate-spin' : ''}`} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                {isLoadingProcedures ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner text="Loading stored procedures..." />
                  </div>
                ) : storedProcedures.length === 0 ? (
                  <Alert className="glass-effect border-yellow-500/20 bg-yellow-500/10">
                    <Info className="h-4 w-4 text-yellow-400" />
                    <AlertDescription className="text-yellow-300">
                      No stored procedures found in the database.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {storedProcedures.map((procedure, index) => (
                      <div key={index} className="border border-gray-700 rounded-lg overflow-hidden">
                        <div className="p-3 bg-gray-800/50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <Code className="h-4 w-4 text-purple-400" />
                              <span className="font-medium text-white">{procedure.name}</span>
                              {procedure.schema !== 'public' && (
                                <Badge variant="outline" className="text-xs border-gray-600 text-gray-400 px-1 py-0">
                                  {procedure.schema}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                                {procedure.language}
                              </Badge>
                              {procedure.is_security_definer && (
                                <Badge variant="secondary" className="text-xs bg-red-500/20 text-red-400 border-red-500/30">
                                  Security Definer
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-xs">
                            {procedure.return_type && (
                              <div className="text-gray-400">
                                <span className="font-semibold">Returns:</span> {procedure.return_type}
                              </div>
                            )}
                            {procedure.argument_types.length > 0 && (
                              <div className="text-gray-400">
                                <span className="font-semibold">Arguments:</span> {procedure.argument_types.join(', ')}
                              </div>
                            )}
                            <div className="text-gray-400 font-mono bg-gray-900/50 p-2 rounded max-h-32 overflow-y-auto">
                              {procedure.definition.substring(0, 300)}
                              {procedure.definition.length > 300 && '...'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Reports (Materialized Views) Tab */}
              <TabsContent value="reports" className="mt-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-400">
                    {materializedViews.length} materialized view{materializedViews.length !== 1 ? 's' : ''}
                  </span>
                  <div className="flex items-center space-x-2">
                    {isLoadingMaterializedViews && (
                      <LoadingSpinner size="sm" text="Loading..." className="text-xs text-blue-400" />
                    )}
                    <Tooltip content="Refresh materialized views list">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={loadMaterializedViews}
                        disabled={!isConnected || isLoadingMaterializedViews}
                        className="h-8 w-8 p-0"
                      >
                        <RefreshCw className={`h-4 w-4 ${isLoadingMaterializedViews ? 'animate-spin' : ''}`} />
                      </Button>
                    </Tooltip>
                  </div>
                </div>

                {isLoadingMaterializedViews ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner text="Loading materialized views..." />
                  </div>
                ) : materializedViews.length === 0 ? (
                  <Alert className="glass-effect border-yellow-500/20 bg-yellow-500/10">
                    <Info className="h-4 w-4 text-yellow-400" />
                    <AlertDescription className="text-yellow-300">
                      No materialized views found in the database.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {materializedViews.map((materializedView, index) => (
                      <div key={index} className="border border-gray-700 rounded-lg overflow-hidden">
                        <div className="p-3 bg-gray-800/50 hover:bg-gray-700/30 cursor-pointer transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <BarChart3 className="h-4 w-4 text-orange-400" />
                              <span className="font-medium text-white">{materializedView.name}</span>
                              {materializedView.schema !== 'public' && (
                                <Badge variant="outline" className="text-xs border-gray-600 text-gray-400 px-1 py-0">
                                  {materializedView.schema}
                                </Badge>
                              )}
                              {materializedView.is_populated ? (
                                <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                                  Populated
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs bg-red-500/20 text-red-400 border-red-500/30">
                                  Not Populated
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              {materializedView.row_count !== undefined && (
                                <span className="text-xs text-gray-400">
                                  {materializedView.row_count.toLocaleString()} rows
                                </span>
                              )}
                              {materializedView.size_bytes && (
                                <span className="text-xs text-gray-400">
                                  {formatBytes(materializedView.size_bytes)}
                                </span>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 hover:bg-gray-600/50 text-gray-500 hover:text-blue-400"
                                onClick={() => onTableSelect?.(materializedView.name, materializedView.schema)}
                                title="Query materialized view"
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-gray-400 font-mono bg-gray-900/50 p-2 rounded max-h-20 overflow-y-auto">
                            {materializedView.definition.substring(0, 200)}
                            {materializedView.definition.length > 200 && '...'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}