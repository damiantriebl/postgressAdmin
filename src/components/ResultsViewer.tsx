import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Hash,
  Clock,
  Database,
  Edit,
  X,
  Plus,
  Trash2,
  AlertTriangle,
  Upload,
  Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { QueryResult, ImportOptions, DetailedColumnInfo } from "@/types/database";
import { DatabaseService } from "@/services/database";
import { useToast } from "@/components/Toast";
import { errorToString } from "@/utils/error";
import EditableCell from "./EditableCell";
import { open } from '@tauri-apps/plugin-dialog';
import ExportDialog from './ExportDialog';

interface ResultsViewerProps {
  queryResult: QueryResult | null;
  isLoading: boolean;
  tableName?: string;
  schemaName?: string;
  enableEditing?: boolean;
  onQueryResultUpdate?: (newResult: QueryResult) => void;
  onOpenRelatedTable?: (tableName: string, schemaName: string, foreignKeyValue: any, columnName: string) => void;
}

export default function ResultsViewer({
  queryResult,
  isLoading,
  tableName,
  schemaName,
  enableEditing = false,
  onQueryResultUpdate,
  onOpenRelatedTable
}: ResultsViewerProps) {
  const { addToast } = useToast();

  // Basic state
  const [displayData, setDisplayData] = useState<QueryResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  // isExporting state removed - handled by ExportDialog
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [detailedColumns, setDetailedColumns] = useState<DetailedColumnInfo[]>([]);
  const [enumValuesCache, setEnumValuesCache] = useState<Map<string, string[]>>(new Map());
  const [foreignKeysInfo, setForeignKeysInfo] = useState<Map<string, any>>(new Map());
  const [isImporting, setIsImporting] = useState(false);

  // Update display data when query result changes
  useEffect(() => {
    setDisplayData(queryResult);
    setCurrentPage(1);
  }, [queryResult]);

  // Load detailed column information when editing is enabled
  useEffect(() => {
    const loadDetailedColumns = async () => {
      if (enableEditing && tableName && queryResult) {
        try {
          console.log('🔧 [ResultsViewer] Loading detailed columns for table:', tableName, schemaName);

          const [columns, foreignKeys] = await Promise.all([
            DatabaseService.getDetailedTableColumns(tableName, schemaName),
            DatabaseService.getTableForeignKeys(tableName, schemaName)
          ]);

          setDetailedColumns(columns);

          // Build foreign keys map
          const fkMap = new Map();
          foreignKeys.forEach((fk: any) => {
            fkMap.set(fk.column_name, fk);
          });
          setForeignKeysInfo(fkMap);

          console.log('🔧 [ResultsViewer] Loaded detailed columns and foreign keys:', columns.length, foreignKeys.length);
        } catch (error) {
          console.error('🚨 [ResultsViewer] Error loading detailed columns:', error);
          addToast({
            type: 'error',
            title: 'Error loading table metadata',
            message: errorToString(error)
          });
        }
      }
    };

    loadDetailedColumns();
  }, [enableEditing, tableName, schemaName, queryResult, addToast]);

  // Toggle edit mode
  const toggleEditMode = () => {
    console.log('🔧 [ResultsViewer] Toggling edit mode from:', isEditMode, 'to:', !isEditMode);
    console.log('🔧 [ResultsViewer] Current state:', {
      tableName,
      enableEditing,
      detailedColumnsLength: detailedColumns.length,
      hasData: displayData?.rows.length || 0
    });
    setIsEditMode(!isEditMode);
  };

  // Handle cell value updates
  const updateCellValue = async (rowIndex: number, columnIndex: number, newValue: any) => {
    if (!tableName || !displayData || !detailedColumns[columnIndex]) return;

    try {
      const column = detailedColumns[columnIndex];
      const primaryKeyColumns = detailedColumns.filter(col => col.is_primary_key);

      if (primaryKeyColumns.length === 0) {
        throw new Error('Cannot update: table has no primary key');
      }

      // Build WHERE clause using primary key(s)
      const whereConditions = primaryKeyColumns.map(pkCol => {
        const pkColumnIndex = detailedColumns.findIndex(col => col.name === pkCol.name);
        const pkValue = displayData.rows[rowIndex][pkColumnIndex];
        return `"${pkCol.name}" = $${primaryKeyColumns.indexOf(pkCol) + 2}`;
      }).join(' AND ');

      const updateQuery = `
        UPDATE "${schemaName || 'public'}"."${tableName}"
        SET "${column.name}" = $1
        WHERE ${whereConditions}
      `;

      const params = [
        newValue,
        ...primaryKeyColumns.map(pkCol => {
          const pkColumnIndex = detailedColumns.findIndex(col => col.name === pkCol.name);
          return displayData.rows[rowIndex][pkColumnIndex];
        })
      ];

      await DatabaseService.executeQuery(updateQuery, params);

      // Update local data
      const updatedData = { ...displayData };
      updatedData.rows[rowIndex][columnIndex] = newValue;
      setDisplayData(updatedData);

      if (onQueryResultUpdate) {
        onQueryResultUpdate(updatedData);
      }

      addToast({
        type: 'success',
        title: 'Cell updated',
        message: `Successfully updated ${column.name}`
      });
    } catch (error) {
      console.error('🚨 [ResultsViewer] Error updating cell:', error);
      addToast({
        type: 'error',
        title: 'Update failed',
        message: errorToString(error)
      });
    }
  };

  const handleImportSQL = async () => {
    setShowImportDialog(true);
  };

  const handleImportFile = async () => {
    try {
      const filePath = await open({
        filters: [{
          name: 'SQL Files',
          extensions: ['sql']
        }]
      });

      if (filePath) {
        setIsImporting(true);

        const importOptions: ImportOptions = {
          format: "SQL" as any,
          table_name: tableName,
          schema_name: schemaName,
          truncate_before_import: false,
          create_table_if_not_exists: false
        };

        const result = await DatabaseService.importSQLFromFile(filePath as string, importOptions);

        if (result.success) {
          addToast({
            type: 'success',
            title: 'Import Successful',
            message: `Successfully imported ${result.rows_imported} rows`,
          });

          if (onQueryResultUpdate && tableName && schemaName) {
            try {
              const refreshedResult = await DatabaseService.queryTable(tableName, schemaName);
              onQueryResultUpdate(refreshedResult);
            } catch (error) {
              console.warn('Failed to refresh table data after import:', error);
            }
          }
        } else {
          addToast({
            type: 'error',
            title: 'Import Failed',
            message: `Import failed with ${result.errors.length} errors: ${result.errors.join(', ')}`,
          });
        }

        setShowImportDialog(false);
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Import Failed',
        message: errorToString(error),
      });
    } finally {
      setIsImporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card className="bg-gray-800/90 backdrop-blur-sm border-gray-700/50 shadow-xl">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-gray-400">Executing query...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!displayData) {
    return (
      <div className="max-w-6xl mx-auto">
        <Card className="bg-gray-800/90 backdrop-blur-sm border-gray-700/50 shadow-xl">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Database className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No query results to display</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalRows = displayData.rows.length;
  const totalPages = Math.ceil(totalRows / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRows);
  const currentRows = displayData.rows.slice(startIndex, endIndex);

  return (
    <div className="max-w-none mx-auto space-y-4">
      <Card className="bg-gray-800/90 backdrop-blur-sm border-gray-700/50 shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-lg text-white">
              <Database className="h-5 w-5 text-green-400" />
              <span>Query Results</span>
              <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                {totalRows.toLocaleString()} rows
              </Badge>
              {displayData.execution_time_ms && (
                <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                  <Clock className="h-3 w-3 mr-1" />
                  {displayData.execution_time_ms}ms
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center space-x-2">
              {enableEditing && (
                <>
                  <Button
                    variant={isEditMode ? "default" : "outline"}
                    size="sm"
                    onClick={toggleEditMode}
                    disabled={(displayData?.rows.length || 0) === 0}
                    className={isEditMode
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "border-gray-600 text-gray-300 hover:bg-gray-700"
                    }
                  >
                    {isEditMode ? <X className="h-4 w-4 mr-1" /> : <Edit className="h-4 w-4 mr-1" />}
                    {isEditMode ? 'Exit Edit' : 'Edit'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {/* TODO: handleInsertRow */ }}
                    disabled={!tableName || detailedColumns.length === 0}
                    className="border-green-600 text-green-300 hover:bg-green-700/20"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Insert
                  </Button>
                </>
              )}
              <ExportDialog
                data={displayData}
                tableName={tableName}
                schemaName={schemaName}
                exportType={tableName ? "table" : "query"}
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(displayData?.rows.length || 0) === 0}
                    className="border-gray-600 text-gray-300 hover:bg-gray-700"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export Data
                  </Button>
                }
              />
              {tableName && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImportSQL}
                  disabled={isImporting}
                  className="border-green-600 text-green-300 hover:bg-green-700/20"
                >
                  <Upload className="h-4 w-4 mr-1" />
                  Import SQL
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Edit mode status */}
          {isEditMode && (
            <div className="flex items-center justify-between p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-center space-x-2">
                <Edit className="h-4 w-4 text-blue-400" />
                <span className="text-blue-300 font-medium">Edit Mode Active</span>
              </div>
              <div className="text-xs text-gray-400">
                Click any cell to edit • Enter to save • Escape to cancel
              </div>
            </div>
          )}

          {(displayData?.rows.length || 0) === 0 ? (
            <Alert className="glass-effect border-blue-500/20 bg-blue-500/10">
              <Database className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-blue-300">
                Query executed successfully but returned no rows.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Results Table */}
              <div className="border border-gray-700 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-700 bg-gray-800/50">
                      {displayData.columns.map((column, index) => (
                        <TableHead key={index} className="text-gray-300 font-medium border-r border-gray-700 last:border-r-0">
                          <div className="flex items-center space-x-1">
                            <Hash className="h-3 w-3 text-gray-500" />
                            <span className="truncate">{column}</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentRows.map((row, rowIndex) => (
                      <TableRow key={startIndex + rowIndex} className="border-gray-700 hover:bg-gray-800/30">
                        {row.map((cell, cellIndex) => {
                          const columnInfo = detailedColumns[cellIndex];
                          const enumValues = columnInfo ? enumValuesCache.get(columnInfo.udt_name) || [] : [];
                          const foreignKeyInfo = columnInfo ? foreignKeysInfo.get(columnInfo.name) : undefined;

                          return (
                            <TableCell key={cellIndex} className="border-r border-gray-700 last:border-r-0 text-sm p-0 min-w-[120px] flex-shrink-0">
                              {isEditMode && columnInfo ? (
                                <EditableCell
                                  value={cell}
                                  columnInfo={columnInfo}
                                  onSave={(newValue) => updateCellValue(startIndex + rowIndex, cellIndex, newValue)}
                                  enumValues={enumValues}
                                  rowIndex={startIndex + rowIndex}
                                  columnIndex={cellIndex}
                                  onOpenRelatedTable={(tableName, schemaName, foreignKeyValue, columnName) =>
                                    onOpenRelatedTable && onOpenRelatedTable(tableName, schemaName, foreignKeyValue, columnName)
                                  }
                                  foreignKeyInfo={foreignKeyInfo}
                                />
                              ) : (
                                <div className="p-2 text-gray-300 font-mono">
                                  <div className="max-w-xs truncate" title={String(cell || '')}>
                                    {cell === null ? (
                                      <span className="text-gray-500 italic">NULL</span>
                                    ) : (
                                      String(cell)
                                    )}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">
                      Showing {startIndex + 1}-{endIndex} of {totalRows.toLocaleString()} rows
                    </span>
                    <Select value={pageSize.toString()} onValueChange={(value) => {
                      setPageSize(parseInt(value));
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-20 bg-gray-700 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                        <SelectItem value="200">200</SelectItem>
                        <SelectItem value="500">500</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-gray-400">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Import SQL Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="bg-gray-800 border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Import SQL File</DialogTitle>
            <DialogDescription className="text-gray-400">
              Select an SQL file to import into {tableName ? `table "${tableName}"` : 'the database'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert className="glass-effect border-yellow-500/20 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-300">
                This will execute SQL statements from the file. Make sure you trust the source.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(false)}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportFile}
              disabled={isImporting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isImporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Select & Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}