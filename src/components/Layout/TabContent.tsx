import { Tab } from "@/hooks/useTabManager";
import ConnectionManager from "@/components/ConnectionManager";
import QueryEditor from "@/components/QueryEditor";
import ResultsViewer from "@/components/ResultsViewer";
import SchemaExplorer from "@/components/SchemaExplorer";
import { QueryResult } from "@/types/database";

interface TabContentProps {
  tab: Tab;
  isConnected: boolean;
  queryResult?: QueryResult | null;
  isExecuting?: boolean;
  onConnectionChange?: (connected: boolean) => void;
  onQueryResult?: (result: QueryResult | null) => void;
  onQueryExecuting?: (executing: boolean) => void;
}

export default function TabContent({
  tab,
  isConnected,
  queryResult,
  isExecuting,
  onConnectionChange,
  onQueryResult,
  onQueryExecuting
}: TabContentProps) {
  const renderTabContent = () => {
    switch (tab.type) {
      case 'connection':
        return (
          <div className="space-y-6">
            <ConnectionManager onConnectionChange={onConnectionChange} />
          </div>
        );

      case 'query':
        return (
          <div className="space-y-6">
            <QueryEditor
              isConnected={isConnected}
              onQueryResult={onQueryResult}
              onQueryExecuting={onQueryExecuting}
            />
            <ResultsViewer
              queryResult={queryResult || null}
              isLoading={isExecuting || false}
              tableName={undefined}
              schemaName={undefined}
            />
          </div>
        );

      case 'schema':
        return (
          <div className="space-y-6">
            <SchemaExplorer isConnected={isConnected} />
          </div>
        );

      default:
        return (
          <div className="flex items-center justify-center py-12">
            <p className="text-gray-400">Unknown tab type</p>
          </div>
        );
    }
  };

  return (
    <div className="w-full">
      {renderTabContent()}
    </div>
  );
}