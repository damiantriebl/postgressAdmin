import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Download, 
  FileText, 
  FileJson, 
  FileCode, 
  FolderOpen,
  Loader2
} from "lucide-react";
import { ExportFormat, ExportOptions, SqlExportType, QueryResult } from "@/types/database";
import { DatabaseService } from "@/services/database";
import { useToast } from "@/components/Toast";
import { errorToString } from "@/utils/error";
import { save } from '@tauri-apps/plugin-dialog';

interface ExportDialogProps {
  data?: QueryResult;
  tableName?: string;
  schemaName?: string;
  trigger: React.ReactNode;
  exportType: 'table' | 'query';
}

export default function ExportDialog({ 
  data, 
  tableName, 
  schemaName, 
  trigger, 
  exportType 
}: ExportDialogProps) {
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(ExportFormat.CSV);
  const [sqlType, setSqlType] = useState<SqlExportType>(SqlExportType.INSERT);
  const [includeHeaders, setIncludeHeaders] = useState(true);
  const [prettyJson, setPrettyJson] = useState(true);
  const [customFileName, setCustomFileName] = useState('');
  const [selectedPath, setSelectedPath] = useState('');

  const formatOptions = [
    { value: ExportFormat.CSV, label: 'CSV', icon: FileText, description: 'Comma-separated values' },
    { value: ExportFormat.JSON, label: 'JSON', icon: FileJson, description: 'JavaScript Object Notation' },
    { value: ExportFormat.SQL, label: 'SQL', icon: FileCode, description: 'SQL statements' }
  ];

  const sqlTypeOptions = [
    { value: SqlExportType.INSERT, label: 'INSERT', description: 'INSERT statements only' },
    { value: SqlExportType.SEED, label: 'SEED', description: 'INSERT with table structure' },
    { value: SqlExportType.FULL_BACKUP, label: 'FULL BACKUP', description: 'Complete table backup' }
  ];

  const getDefaultFileName = () => {
    const baseName = tableName || 'export';
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const extension = selectedFormat === ExportFormat.CSV ? 'csv' : 
                     selectedFormat === ExportFormat.JSON ? 'json' : 'sql';
    
    if (selectedFormat === ExportFormat.SQL) {
      const sqlTypeMap = {
        [SqlExportType.INSERT]: 'insert',
        [SqlExportType.SEED]: 'seed',
        [SqlExportType.FULL_BACKUP]: 'backup'
      };
      return `${baseName}_${sqlTypeMap[sqlType]}_${timestamp}.${extension}`;
    }
    
    return `${baseName}_${timestamp}.${extension}`;
  };

  const selectSaveLocation = async () => {
    try {
      const fileName = customFileName || getDefaultFileName();
      const extension = selectedFormat === ExportFormat.CSV ? 'csv' : 
                       selectedFormat === ExportFormat.JSON ? 'json' : 'sql';
      
      const filePath = await save({
        defaultPath: fileName,
        filters: [
          {
            name: `${selectedFormat} Files`,
            extensions: [extension]
          },
          {
            name: 'All Files',
            extensions: ['*']
          }
        ]
      });

      if (filePath && typeof filePath === 'string') {
        setSelectedPath(filePath);
        addToast({
          type: 'success',
          title: 'Location Selected',
          message: `File will be saved to: ${filePath}`,
        });
      }
    } catch (error) {
      console.error('Error selecting save location:', error);
      addToast({
        type: 'error',
        title: 'Selection Failed',
        message: 'Failed to open file dialog. Please try again.',
      });
    }
  };

  const handleExport = async () => {
    if (!selectedPath) {
      addToast({
        type: 'error',
        title: 'No Location Selected',
        message: 'Please select a save location first.',
      });
      return;
    }

    setIsExporting(true);
    try {
      addToast({
        type: 'info',
        title: 'Exporting Data',
        message: `Preparing ${selectedFormat} export...`,
      });

      let exportResult;

      if (selectedFormat === ExportFormat.SQL) {
        if (!tableName) {
          throw new Error('Table name is required for SQL export');
        }
        
        if (exportType === 'table' && tableName && schemaName) {
          exportResult = await DatabaseService.exportTableAsSQL(tableName, schemaName, sqlType);
        } else if (data) {
          exportResult = await DatabaseService.exportQueryResultAsSQL(data, tableName, schemaName);
        } else {
          throw new Error('No data available for export');
        }
      } else {
        const exportOptions: ExportOptions = {
          format: selectedFormat,
          include_headers: includeHeaders,
          pretty_json: prettyJson,
        };

        if (exportType === 'table' && tableName && schemaName) {
          exportResult = await DatabaseService.exportTableAsCsvJson(tableName, exportOptions, schemaName);
        } else if (data) {
          exportResult = await DatabaseService.exportExistingResults(data, exportOptions);
        } else {
          throw new Error('No data available for export');
        }
      }

      // Save the file to the selected location
      await DatabaseService.saveExportToFile(exportResult, selectedPath);

      addToast({
        type: 'success',
        title: 'Export Successful',
        message: `Data exported successfully to: ${selectedPath}`,
      });

      setIsOpen(false);
      setSelectedPath('');
      setCustomFileName('');
    } catch (error) {
      console.error('Export error:', error);
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: errorToString(error),
      });
    } finally {
      setIsExporting(false);
    }
  };

  const resetDialog = () => {
    setSelectedPath('');
    setCustomFileName('');
    setSelectedFormat(ExportFormat.CSV);
    setSqlType(SqlExportType.INSERT);
    setIncludeHeaders(true);
    setPrettyJson(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) resetDialog();
    }}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center space-x-2">
            <Download className="h-5 w-5" />
            <span>Export Data</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Format Selection */}
          <div className="space-y-3">
            <Label className="text-white font-medium">Export Format</Label>
            <div className="grid grid-cols-3 gap-3">
              {formatOptions.map((format) => {
                const Icon = format.icon;
                return (
                  <Card 
                    key={format.value}
                    className={`cursor-pointer transition-colors ${
                      selectedFormat === format.value 
                        ? 'bg-blue-600/20 border-blue-500' 
                        : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                    }`}
                    onClick={() => setSelectedFormat(format.value)}
                  >
                    <CardContent className="p-3 text-center">
                      <Icon className="h-6 w-6 mx-auto mb-2 text-gray-300" />
                      <div className="text-sm font-medium text-white">{format.label}</div>
                      <div className="text-xs text-gray-400">{format.description}</div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* SQL Type Selection (only for SQL format) */}
          {selectedFormat === ExportFormat.SQL && (
            <div className="space-y-3">
              <Label className="text-white font-medium">SQL Export Type</Label>
              <Select value={sqlType} onValueChange={(value) => setSqlType(value as SqlExportType)}>
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {sqlTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-white hover:bg-gray-700">
                      <div>
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-gray-400">{option.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Options for CSV/JSON */}
          {selectedFormat !== ExportFormat.SQL && (
            <div className="space-y-3">
              <Label className="text-white font-medium">Export Options</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeHeaders" 
                    checked={includeHeaders}
                    onCheckedChange={(checked) => setIncludeHeaders(checked === true)}
                  />
                  <Label htmlFor="includeHeaders" className="text-gray-300">Include column headers</Label>
                </div>
                {selectedFormat === ExportFormat.JSON && (
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="prettyJson" 
                      checked={prettyJson}
                      onCheckedChange={(checked) => setPrettyJson(checked === true)}
                    />
                    <Label htmlFor="prettyJson" className="text-gray-300">Pretty format JSON</Label>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* File Name */}
          <div className="space-y-3">
            <Label className="text-white font-medium">File Name (Optional)</Label>
            <Input
              value={customFileName}
              onChange={(e) => setCustomFileName(e.target.value)}
              placeholder={getDefaultFileName()}
              className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
            />
            <div className="text-xs text-gray-400">
              Leave empty to use default name: {getDefaultFileName()}
            </div>
          </div>

          {/* Save Location */}
          <div className="space-y-3">
            <Label className="text-white font-medium">Save Location</Label>
            <div className="flex space-x-2">
              <Button
                onClick={selectSaveLocation}
                variant="outline"
                className="flex-1 bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Choose Location
              </Button>
            </div>
            {selectedPath && (
              <div className="p-2 bg-gray-700/50 rounded border border-gray-600">
                <div className="text-xs text-gray-400">Selected location:</div>
                <div className="text-sm text-white font-mono break-all">{selectedPath}</div>
              </div>
            )}
          </div>

          {/* Export Info */}
          <Card className="bg-gray-700/30 border-gray-600">
            <CardContent className="p-3">
              <div className="text-sm text-gray-300">
                <div className="flex justify-between">
                  <span>Export type:</span>
                  <Badge variant="secondary">{exportType === 'table' ? 'Full Table' : 'Query Results'}</Badge>
                </div>
                {tableName && (
                  <div className="flex justify-between mt-1">
                    <span>Table:</span>
                    <span className="font-mono">{schemaName}.{tableName}</span>
                  </div>
                )}
                {data && (
                  <div className="flex justify-between mt-1">
                    <span>Rows:</span>
                    <span>{data.rows.length.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isExporting}
              className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isExporting || !selectedPath}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}