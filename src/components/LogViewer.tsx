import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { RefreshCw, Download, Trash2, AlertTriangle, Info, XCircle } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: string;
  target: string;
  message: string;
  operation?: string;
  duration_ms?: number;
  error_code?: string;
  connection_id?: string;
  query_hash?: string;
}

interface LogSummary {
  total_entries: number;
  error_count: number;
  warning_count: number;
  info_count: number;
  debug_count: number;
  last_error?: string;
  last_error_time?: string;
}

// Helper functions moved outside component
const formatTimestamp = (timestamp: string) => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch {
    return timestamp;
  }
};

const getLevelIcon = (level: string) => {
  switch (level) {
    case 'ERROR':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'WARN':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'INFO':
      return <Info className="h-4 w-4 text-blue-500" />;
    default:
      return <Info className="h-4 w-4 text-gray-500" />;
  }
};

const getLevelBadge = (level: string) => {
  const variants = {
    ERROR: 'destructive',
    WARN: 'secondary',
    INFO: 'default',
    DEBUG: 'outline'
  } as const;
  
  return (
    <Badge variant={variants[level as keyof typeof variants] || 'outline'}>
      {level}
    </Badge>
  );
};

const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<LogSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [logsData, summaryData] = await Promise.all([
        invoke<LogEntry[]>('get_logs', { limit: 100 }),
        invoke<LogSummary>('get_log_summary')
      ]);
      
      setLogs(logsData);
      setSummary(summaryData);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs?')) {
      return;
    }
    
    try {
      await invoke('clear_logs');
      await loadLogs();
    } catch (err) {
      setError(err as string);
    }
  };

  const exportLogs = async () => {
    try {
      const result = await invoke<string>('export_logs');
      alert(result);
    } catch (err) {
      setError(err as string);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  if (error) {
    return (
      <Alert className="mb-4">
        <XCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load logs: {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>System Logs</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadLogs}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportLogs}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearLogs}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{summary.total_entries}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{summary.error_count}</div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">{summary.warning_count}</div>
                <div className="text-sm text-muted-foreground">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{summary.info_count}</div>
                <div className="text-sm text-muted-foreground">Info</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-500">{summary.debug_count}</div>
                <div className="text-sm text-muted-foreground">Debug</div>
              </div>
            </div>
          )}

          {summary?.last_error && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold">Last Error:</div>
                <div className="text-sm mt-1">{summary.last_error}</div>
                {summary.last_error_time && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatTimestamp(summary.last_error_time)}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="errors">Errors</TabsTrigger>
              <TabsTrigger value="warnings">Warnings</TabsTrigger>
              <TabsTrigger value="info">Info</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <LogTable logs={logs} />
            </TabsContent>

            <TabsContent value="errors" className="mt-4">
              <LogTable logs={logs.filter(log => log.level === 'ERROR')} />
            </TabsContent>

            <TabsContent value="warnings" className="mt-4">
              <LogTable logs={logs.filter(log => log.level === 'WARN')} />
            </TabsContent>

            <TabsContent value="info" className="mt-4">
              <LogTable logs={logs.filter(log => log.level === 'INFO')} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

interface LogTableProps {
  logs: LogEntry[];
}

const LogTable: React.FC<LogTableProps> = ({ logs }) => {
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No logs found
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Operation</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log, index) => (
            <TableRow key={index}>
              <TableCell className="font-mono text-xs">
                {formatTimestamp(log.timestamp)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getLevelIcon(log.level)}
                  {getLevelBadge(log.level)}
                </div>
              </TableCell>
              <TableCell>
                {log.operation ? (
                  <Badge variant="outline">{log.operation}</Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="max-w-md">
                <div className="truncate" title={log.message}>
                  {log.message}
                </div>
              </TableCell>
              <TableCell>
                {log.duration_ms ? (
                  <span className="text-sm text-muted-foreground">
                    {log.duration_ms}ms
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default LogViewer; 