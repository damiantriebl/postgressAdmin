import { invoke } from '@tauri-apps/api/core';
import { QueryResult, TableInfo, ColumnInfo, DetailedColumnInfo, QueryValidationResponse, TableSizeInfo, IndexInfo, ForeignKeyInfo, TableStatistics, DatabaseStatistics, ExportOptions, ExportResult, ExportPreview, SqlExportType, ImportOptions, ImportResult, ViewInfo, StoredProcedureInfo, MaterializedViewInfo, CreateIndexOptions } from '../types/database';

export interface ConnectionStatus {
  connected: boolean;
  message: string;
}

export interface ConnectionDisplayInfo {
  host: string;
  database: string;
  username: string;
  ssl_enabled: boolean;
}

// Helper function to add timeout to invoke calls
const invokeWithTimeout = async <T>(command: string, args?: any, timeoutMs: number = 30000): Promise<T> => {
  return Promise.race([
    invoke<T>(command, args),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Command '${command}' timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
};



export class DatabaseService {
  static async connect(connectionString: string, saveConnection?: boolean): Promise<string> {
    const result = await invoke('connect_database', { connectionString, saveConnection });
    return typeof result === 'string' ? result : 'Connected successfully';
  }

  static async disconnect(): Promise<string> {
    await invoke('disconnect_database');
    return 'Disconnected successfully';
  }

  static async testConnection(): Promise<string> {
    console.log('🔧 [DatabaseService] testConnection called');
    
    try {
      // Test with a simple query
      const result = await invoke('execute_query', { query: 'SELECT 1 as test' });
      console.log('🔧 [DatabaseService] testConnection result:', result);
      return 'Connection test successful';
    } catch (error) {
      console.error('🔧 [DatabaseService] testConnection error:', error);
      throw error;
    }
  }

  static async isConnected(): Promise<boolean> {
    return invoke('is_connected');
  }

  static async getConnectionStatus(): Promise<ConnectionStatus> {
    return invoke('get_connection_status');
  }

  static async validateConnectionString(connectionString: string): Promise<string> {
    // Simple validation - just check if it looks like a postgres connection string
    if (connectionString.includes('postgresql://') || connectionString.includes('postgres://')) {
      return 'Connection string format is valid';
    }
    throw new Error('Invalid PostgreSQL connection string format');
  }

  static async getConnectionInfo(): Promise<ConnectionDisplayInfo | null> {
    // For now, return null since we don't have this implemented in simple DB
    return null;
  }

  static async autoReconnect(): Promise<boolean> {
    // Not implemented in simple DB
    return false;
  }

  static async hasSavedConnection(): Promise<boolean> {
    // Not implemented in simple DB
    return false;
  }

  static async deleteSavedConnection(): Promise<string> {
    // Not implemented in simple DB
    return 'No saved connections to delete';
  }

  static async saveCurrentConnection(): Promise<string> {
    // Not implemented in simple DB
    return 'Connection saving not implemented';
  }

  static async resetConnection(): Promise<string> {
    await this.disconnect();
    return 'Connection reset';
  }

  static async emergencyRestart(): Promise<string> {
    // Not implemented in simple DB
    throw new Error('Emergency restart not available');
  }

  // Simple database methods (new implementation)
  static async simpleConnect(connectionString: string): Promise<string> {
    return invoke('simple_connect', { connectionString });
  }

  static async simpleDisconnect(): Promise<string> {
    return invoke('simple_disconnect');
  }

  static async simpleIsConnected(): Promise<boolean> {
    return invoke('simple_is_connected');
  }

  static async simpleExecuteQuery(query: string): Promise<any> {
    return invoke('simple_execute_query', { query });
  }

  static async simpleGetTables(): Promise<any[]> {
    return invoke('simple_get_tables');
  }

  static async simpleBuildSafeQuery(tableName: string, schemaName: string, limit?: number): Promise<string> {
    return invoke('simple_build_safe_query', { tableName, schemaName, limit });
  }



  static async executeDirectQuery(connectionString: string, query: string): Promise<QueryResult> {
    return invoke('execute_direct_query', { connectionString, query });
  }

  static async simpleQuery(connectionString: string, query: string): Promise<any> {
    return invoke('simple_query', { connectionString, query });
  }

  static async simpleTestConnection(connectionString: string): Promise<string> {
    return invoke('simple_test_connection', { connectionString });
  }

  static async executeQuery(query: string): Promise<QueryResult> {
    console.log('🔧 [DatabaseService] executeQuery called with:', query);
    
    try {
      console.log('🔧 [DatabaseService] Starting invoke call...');
      const result = await invoke('execute_query', { query });
      console.log('🔧 [DatabaseService] executeQuery result:', result);
      return result as QueryResult;
    } catch (error) {
      console.error('🔧 [DatabaseService] executeQuery error:', error);
      throw error;
    }
  }

  static async executeQueryPaginated(query: string, page?: number, pageSize?: number): Promise<QueryResult> {
    return invoke('execute_query_paginated', { query, page, pageSize });
  }

  static async executeSimpleQuery(query: string): Promise<string> {
    console.log('🔧 [DatabaseService] executeSimpleQuery called with:', query);
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Simple query execution timed out after 10 seconds'));
      }, 10000);
    });
    
    try {
      console.log('🔧 [DatabaseService] Starting simple query invoke call...');
      const result = await Promise.race([
        invoke('execute_simple_query', { query }),
        timeoutPromise
      ]);
      console.log('🔧 [DatabaseService] executeSimpleQuery result:', result);
      return result as string;
    } catch (error) {
      console.error('🔧 [DatabaseService] executeSimpleQuery error:', error);
      throw error;
    }
  }

  static async validateQuery(query: string): Promise<QueryValidationResponse> {
    return invoke('validate_query', { query });
  }

  static async getTables(): Promise<TableInfo[]> {
    return invoke('get_tables');
  }

  static async getTableColumns(tableName: string, schemaName?: string): Promise<ColumnInfo[]> {
    return invoke('get_table_columns', { tableName, schemaName });
  }

  static async buildSafeQuery(tableName: string, schemaName?: string): Promise<string> {
    return invoke('build_safe_query', { tableName, schemaName });
  }

  static async queryTable(tableName: string, schemaName?: string): Promise<QueryResult> {
    return invoke('query_table', { tableName, schemaName });
  }

  // Alias for compatibility
  static async simpleQueryTable(tableName: string, schemaName?: string, _limit?: number): Promise<QueryResult> {
    return this.queryTable(tableName, schemaName);
  }

  static async getTableRowCount(tableName: string, schemaName?: string): Promise<number> {
    return invoke('get_table_row_count', { tableName, schemaName });
  }

  static async getTableSize(tableName: string, schemaName?: string): Promise<TableSizeInfo> {
    return invoke('get_table_size', { tableName, schemaName });
  }

  static async getSchemas(): Promise<string[]> {
    return invoke('get_schemas');
  }

  static async getTableIndexes(tableName: string, schemaName?: string): Promise<IndexInfo[]> {
    return invokeWithTimeout('get_table_indexes', { tableName, schemaName }, 10000); // Aumentar de 5000 a 10000
  }

  static async getTableForeignKeys(tableName: string, schemaName?: string): Promise<ForeignKeyInfo[]> {
    return invokeWithTimeout('get_table_foreign_keys', { tableName, schemaName }, 10000); // Aumentar de 5000 a 10000
  }

  static async getTableStatistics(tableName: string, schemaName?: string): Promise<TableStatistics> {
    return invoke('get_table_statistics', { tableName, schemaName });
  }

  static async getAllIndexes(): Promise<IndexInfo[]> {
    return invoke('get_all_indexes');
  }

  static async getViews(): Promise<ViewInfo[]> {
    return invoke('get_views');
  }

  static async getStoredProcedures(): Promise<StoredProcedureInfo[]> {
    return invoke('get_stored_procedures');
  }

  static async getMaterializedViews(): Promise<MaterializedViewInfo[]> {
    return invoke('get_materialized_views');
  }

  static async createIndex(options: CreateIndexOptions): Promise<string> {
    return invoke('create_index', { options });
  }

  static async dropIndex(indexName: string, schemaName?: string): Promise<string> {
    return invoke('drop_index', { indexName, schemaName });
  }

  static async getDatabaseStatistics(): Promise<DatabaseStatistics> {
    return invoke('get_database_statistics');
  }

  static async exportQueryResults(query: string, exportOptions: ExportOptions): Promise<ExportResult> {
    return invoke('export_query_results', { query, exportOptions });
  }

  static async exportExistingResults(queryResult: QueryResult, exportOptions: ExportOptions): Promise<ExportResult> {
    return invoke('export_existing_results', { queryResult, exportOptions });
  }

  static async saveExportToFile(exportResult: ExportResult, filePath: string): Promise<string> {
    return invoke('save_export_to_file', { exportResult, filePath });
  }

  static async previewExport(queryResult: QueryResult, exportOptions: ExportOptions): Promise<ExportPreview> {
    return invoke('preview_export', { queryResult, exportOptions });
  }

  static async getDetailedTableColumns(tableName: string, schemaName?: string): Promise<DetailedColumnInfo[]> {
    return invoke('get_detailed_table_columns', { tableName, schemaName });
  }

  static async getEnumValues(enumName: string): Promise<string[]> {
    return invoke('get_enum_values', { enumName });
  }

  static async updateRow(
    tableName: string, 
    schemaName: string | undefined, 
    primaryKeyColumns: string[], 
    primaryKeyValues: any[], 
    columnUpdates: Record<string, any>
  ): Promise<number> {
    return invoke('update_row', { 
      tableName, 
      schemaName, 
      primaryKeyColumns, 
      primaryKeyValues, 
      columnUpdates 
    });
  }

  static async insertRow(
    tableName: string, 
    schemaName: string | undefined, 
    columnValues: Record<string, any>
  ): Promise<number> {
    return invoke('insert_row', { 
      tableName, 
      schemaName, 
      columnValues 
    });
  }

  static async deleteRow(
    tableName: string, 
    schemaName: string | undefined, 
    primaryKeyColumns: string[], 
    primaryKeyValues: any[]
  ): Promise<number> {
    return invoke('delete_row', { 
      tableName, 
      schemaName, 
      primaryKeyColumns, 
      primaryKeyValues 
    });
  }

  static async beginTransaction(): Promise<void> {
    return invoke('begin_transaction');
  }

  static async commitTransaction(): Promise<void> {
    return invoke('commit_transaction');
  }

  static async rollbackTransaction(): Promise<void> {
    return invoke('rollback_transaction');
  }

  static async executeTransaction(operations: any[]): Promise<number[]> {
    return invoke('execute_transaction', { operations });
  }

  // Performance optimization methods
  static async getPoolStatus(): Promise<any> {
    return invoke('get_pool_status');
  }

  static async executeStreamingQuery(query: string, pageSize?: number, offset?: number): Promise<QueryResult> {
    console.log('🔧 [DatabaseService] executeStreamingQuery called with:', { query, pageSize, offset });
    
    try {
      const result = await invoke('execute_streaming_query', { 
        query, 
        pageSize: pageSize || 1000, 
        offset: offset || 0 
      });
      console.log('🔧 [DatabaseService] executeStreamingQuery result:', result);
      return result as QueryResult;
    } catch (error) {
      console.error('🔧 [DatabaseService] executeStreamingQuery error:', error);
      throw error;
    }
  }

  // SQL Export and Import methods
  static async exportTableAsSQL(tableName: string, schemaName?: string, sqlType: SqlExportType = SqlExportType.INSERT): Promise<ExportResult> {
    console.log('🔧 [DatabaseService] exportTableAsSQL called with:', { tableName, schemaName, sqlType });
    
    try {
      const result = await invoke('export_table_sql', {
        tableName,
        schemaName,
        sqlType
      });
      console.log('🔧 [DatabaseService] exportTableAsSQL result:', result);
      return result as ExportResult;
    } catch (error) {
      console.error('🔧 [DatabaseService] exportTableAsSQL error:', error);
      throw error;
    }
  }

  static async exportTableAsCsvJson(tableName: string, exportOptions: ExportOptions, schemaName?: string): Promise<ExportResult> {
    console.log('🔧 [DatabaseService] exportTableAsCsvJson called with:', { tableName, schemaName, exportOptions });
    
    try {
      const result = await invoke('export_table_csv_json', {
        tableName,
        schemaName,
        exportOptions
      });
      console.log('🔧 [DatabaseService] exportTableAsCsvJson result:', result);
      return result as ExportResult;
    } catch (error) {
      console.error('🔧 [DatabaseService] exportTableAsCsvJson error:', error);
      throw error;
    }
  }

  static async exportQueryResultAsSQL(queryResult: QueryResult, tableName: string, schemaName?: string): Promise<ExportResult> {
    console.log('🔧 [DatabaseService] exportQueryResultAsSQL called with:', { tableName, schemaName });
    
    try {
      const result = await invoke('export_query_result_sql', {
        queryResult,
        tableName,
        schemaName
      });
      console.log('🔧 [DatabaseService] exportQueryResultAsSQL result:', result);
      return result as ExportResult;
    } catch (error) {
      console.error('🔧 [DatabaseService] exportQueryResultAsSQL error:', error);
      throw error;
    }
  }

  static async importSQLFile(sqlContent: string, importOptions: ImportOptions): Promise<ImportResult> {
    console.log('🔧 [DatabaseService] importSQLFile called');
    
    try {
      const result = await invoke('import_sql_file', {
        sqlContent,
        importOptions
      });
      console.log('🔧 [DatabaseService] importSQLFile result:', result);
      return result as ImportResult;
    } catch (error) {
      console.error('🔧 [DatabaseService] importSQLFile error:', error);
      throw error;
    }
  }

  static async importSQLFromFile(filePath: string, importOptions: ImportOptions): Promise<ImportResult> {
    console.log('🔧 [DatabaseService] importSQLFromFile called with:', { filePath });
    
    try {
      const result = await invoke('import_sql_from_file', {
        filePath,
        importOptions
      });
      console.log('🔧 [DatabaseService] importSQLFromFile result:', result);
      return result as ImportResult;
    } catch (error) {
      console.error('🔧 [DatabaseService] importSQLFromFile error:', error);
      throw error;
    }
  }
}