import { useState, useEffect, useRef } from "react";
import { Play, RotateCcw, XCircle, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DatabaseService } from "@/services/database";
import { QueryResult, QueryValidationResponse, QueryHistoryItem } from "@/types/database";
import { useToast } from "@/components/Toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import { errorToString } from "@/utils/error";
import Tooltip from "./Tooltip";

interface QueryEditorProps {
  isConnected: boolean;
  onQueryResult?: (result: QueryResult | null) => void;
  onQueryExecuting?: (executing: boolean) => void;
  initialQuery?: string; // Nueva prop
}

export default function QueryEditor({ 
  isConnected, 
  onQueryResult, 
  onQueryExecuting,
  initialQuery = "" // Nueva prop con valor por defecto
}: QueryEditorProps) {
  const { addToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [sqlQuery, setSqlQuery] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryMessage, setQueryMessage] = useState("");
  const [queryValidation, setQueryValidation] = useState<QueryValidationResponse | null>(null);
  const [isValidatingQuery, setIsValidatingQuery] = useState(false);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const validateQueryInRealTime = async (query: string) => {
    if (!query.trim() || !isConnected) {
      setQueryValidation(null);
      return;
    }

    setIsValidatingQuery(true);
    try {
      const validation = await DatabaseService.validateQuery(query);
      setQueryValidation(validation);
    } catch (error) {
      setQueryValidation({
        is_valid: false,
        warnings: [errorToString(error)],
        query_type: "Unknown",
        is_destructive: false,
        risk_level: "High"
      });
    } finally {
      setIsValidatingQuery(false);
    }
  };

  const handleExecuteQuery = async () => {
    if (!sqlQuery.trim()) {
      setQueryMessage("Please enter a SQL query");
      return;
    }

    if (!isConnected) {
      setQueryMessage("Please connect to database first");
      return;
    }

    setIsExecuting(true);
    setQueryMessage("");
    onQueryExecuting?.(true);

    try {
      const result = await DatabaseService.executeQuery(sqlQuery.trim());
      
      onQueryResult?.(result);
      
      // Add to history
      const historyItem: QueryHistoryItem = {
        query: sqlQuery.trim(),
        timestamp: new Date(),
        success: true
      };
      setQueryHistory(prev => [historyItem, ...prev.slice(0, 19)]); // Keep last 20 queries
      
      setQueryMessage(`Query executed successfully in ${result.execution_time_ms}ms. ${result.rows_affected} rows affected.`);
      
      addToast({
        type: 'success',
        title: 'Query Executed',
        message: `Query completed in ${result.execution_time_ms}ms`,
      });
    } catch (error) {
      const errorMessage = errorToString(error);
      setQueryMessage(errorMessage);
      
      // Add failed query to history
      const historyItem: QueryHistoryItem = {
        query: sqlQuery.trim(),
        timestamp: new Date(),
        success: false
      };
      setQueryHistory(prev => [historyItem, ...prev.slice(0, 19)]);
      
      onQueryResult?.(null);
      
      addToast({
        type: 'error',
        title: 'Query Failed',
        message: errorMessage,
      });
    } finally {
      setIsExecuting(false);
      onQueryExecuting?.(false);
    }
  };

  const handleClearQuery = () => {
    setSqlQuery("");
    setQueryMessage("");
    setQueryValidation(null);
    onQueryResult?.(null);
  };

  const handleSelectFromHistory = (query: string) => {
    setSqlQuery(query);
    setShowHistory(false);
    // Focus the textarea after selecting from history
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to execute query
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecuteQuery();
    }
    
    // Ctrl+K or Cmd+K to clear query
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      handleClearQuery();
    }
  };

  // Load query history from localStorage on component mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('queryHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setQueryHistory(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })));
      } catch (error) {
        console.error('Failed to load query history:', error);
      }
    }
  }, []);

  // Save query history to localStorage whenever it changes
  useEffect(() => {
    if (queryHistory.length > 0) {
      localStorage.setItem('queryHistory', JSON.stringify(queryHistory));
    }
  }, [queryHistory]);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Card className="bg-gray-800/90 backdrop-blur-sm border-gray-700/50 shadow-xl hover:bg-gray-800 transition-all duration-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2 text-lg text-white">
              <Play className="h-5 w-5 text-green-400" />
              <span>SQL Query Editor</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              {queryHistory.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <Clock className="h-4 w-4 mr-1" />
                  History ({queryHistory.length})
                </Button>
              )}
              {isValidatingQuery && (
                <LoadingSpinner size="sm" text="Validating..." className="text-xs text-blue-400" />
              )}
              {queryValidation && (
                <div className="flex items-center space-x-2">
                  <Badge
                    variant={
                      queryValidation.risk_level === 'High' ? 'destructive' :
                      queryValidation.risk_level === 'Medium' ? 'secondary' :
                      'default'
                    }
                    className={`text-xs ${
                      queryValidation.risk_level === 'High' ? 'bg-red-500/20 text-red-400' :
                      queryValidation.risk_level === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-green-500/20 text-green-400'
                    }`}
                  >
                    {queryValidation.risk_level} Risk
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {queryValidation.query_type}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="sql-query" className="block text-sm font-medium text-gray-300">
                SQL Query
              </label>
              <div className="text-xs text-gray-500">
                Press Ctrl+Enter to execute • Ctrl+K to clear
              </div>
            </div>
            <Textarea
              ref={textareaRef}
              id="sql-query"
              placeholder="SELECT * FROM your_table LIMIT 10;"
              value={sqlQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSqlQuery(value);
                setQueryMessage("");
                
                // Debounce validation
                setTimeout(() => {
                  validateQueryInRealTime(value);
                }, 800);
              }}
              onKeyDown={handleKeyDown}
              className="bg-gray-900/50 border-gray-600 text-white placeholder-gray-400 min-h-[120px] font-mono text-sm resize-y"
              disabled={isExecuting}
              aria-label="SQL Query Editor"
              aria-describedby="query-help"
              spellCheck={false}
              autoComplete="off"
            />
            
            {/* Hidden help text for screen readers */}
            <div id="query-help" className="sr-only">
              Enter your SQL query here. Use Ctrl+Enter to execute the query. The editor supports syntax validation and query history.
            </div>
            
            {queryValidation && queryValidation.warnings.length > 0 && (
              <div className="mt-2 space-y-1">
                {queryValidation.warnings.map((warning: string, index: number) => (
                  <Alert key={index} className={`glass-effect ${
                    queryValidation.risk_level === 'High' ? 'border-red-500/20 bg-red-500/10' :
                    queryValidation.risk_level === 'Medium' ? 'border-yellow-500/20 bg-yellow-500/10' :
                    'border-blue-500/20 bg-blue-500/10'
                  }`}>
                    <AlertTriangle className={`h-4 w-4 ${
                      queryValidation.risk_level === 'High' ? 'text-red-400' :
                      queryValidation.risk_level === 'Medium' ? 'text-yellow-400' :
                      'text-blue-400'
                    }`} />
                    <AlertDescription className={
                      queryValidation.risk_level === 'High' ? 'text-red-300' :
                      queryValidation.risk_level === 'Medium' ? 'text-yellow-300' :
                      'text-blue-300'
                    }>
                      {warning}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </div>

          <div className="flex space-x-2">
            <Tooltip content="Execute the SQL query (Ctrl+Enter)">
              <Button 
                onClick={handleExecuteQuery}
                disabled={isExecuting || !sqlQuery.trim() || !isConnected}
                className="bg-green-600 hover:bg-green-700"
              >
                {isExecuting ? (
                  <LoadingSpinner size="sm" text="Executing..." />
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Execute Query
                  </>
                )}
              </Button>
            </Tooltip>
            <Tooltip content="Clear the query editor">
              <Button 
                onClick={handleClearQuery}
                variant="outline"
                disabled={isExecuting}
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </Tooltip>
          </div>

          {!isConnected && (
            <Alert className="glass-effect border-yellow-500/20 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-yellow-300">
                Please connect to a database first to execute queries.
              </AlertDescription>
            </Alert>
          )}

          {queryMessage && (
            <Alert className={`glass-effect ${
              queryMessage.includes('success') || queryMessage.includes('executed successfully')
                ? 'border-green-500/20 bg-green-500/10'
                : 'border-red-500/20 bg-red-500/10'
            }`}>
              {queryMessage.includes('success') || queryMessage.includes('executed successfully') ? (
                <Play className="h-4 w-4 text-green-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-400" />
              )}
              <AlertDescription className={
                queryMessage.includes('success') || queryMessage.includes('executed successfully')
                  ? 'text-green-300'
                  : 'text-red-300'
              }>
                {queryMessage}
              </AlertDescription>
            </Alert>
          )}

          {/* Query History */}
          {showHistory && queryHistory.length > 0 && (
            <Card className="bg-gray-900/50 border-gray-600">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-gray-300 flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>Query History</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-60 overflow-y-auto">
                {queryHistory.map((item, index) => (
                  <div
                    key={index}
                    className="p-2 rounded border border-gray-700 hover:bg-gray-800/50 cursor-pointer transition-colors"
                    onClick={() => handleSelectFromHistory(item.query)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={item.success ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {item.success ? 'Success' : 'Failed'}
                        </Badge>
                        {item.executionTime && (
                          <span className="text-xs text-gray-500">
                            {item.executionTime}ms
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {item.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <code className="text-xs text-gray-300 font-mono block truncate">
                      {item.query}
                    </code>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
  
  // Efecto para actualizar la query cuando cambie initialQuery
  useEffect(() => {
    console.log('📝 [QueryEditor] initialQuery changed:', {
      initialQuery,
      currentSqlQuery: sqlQuery,
      willUpdate: initialQuery && initialQuery !== sqlQuery
    });
    
    if (initialQuery && initialQuery !== sqlQuery) {
      console.log('📝 [QueryEditor] Updating sqlQuery to:', initialQuery);
      setSqlQuery(initialQuery);
    }
  }, [initialQuery]);
}