import { X, Plus, Database, Play, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTabManager, Tab } from "@/hooks/useTabManager";

interface TabManagerProps {
  isConnected: boolean;
  onCreateQueryTab?: () => void;
  onCreateSchemaTab?: () => void;
}

export default function TabManager({ 
  isConnected, 
  onCreateQueryTab, 
  onCreateSchemaTab 
}: TabManagerProps) {
  const { 
    tabs, 
    switchTab, 
    closeTab, 
    createQueryTab, 
    createSchemaTab 
  } = useTabManager();

  const getTabIcon = (type: Tab['type']) => {
    switch (type) {
      case 'connection':
        return <Settings className="h-3 w-3" />;
      case 'query':
        return <Play className="h-3 w-3" />;
      case 'schema':
        return <Database className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getTabColor = (type: Tab['type']) => {
    switch (type) {
      case 'connection':
        return 'text-blue-400';
      case 'query':
        return 'text-green-400';
      case 'schema':
        return 'text-purple-400';
      default:
        return 'text-gray-400';
    }
  };

  const handleCreateQueryTab = () => {
    createQueryTab();
    onCreateQueryTab?.();
  };

  const handleCreateSchemaTab = () => {
    createSchemaTab();
    onCreateSchemaTab?.();
  };

  return (
    <div className="bg-gray-800/90 backdrop-blur-sm border-b border-gray-700/50">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Tab List */}
        <div className="flex items-center space-x-1 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`
                flex items-center space-x-2 px-3 py-2 rounded-t-lg cursor-pointer transition-all duration-200
                ${tab.isActive 
                  ? 'bg-gray-700/80 border-b-2 border-blue-400' 
                  : 'bg-gray-800/50 hover:bg-gray-700/50'
                }
              `}
              onClick={() => switchTab(tab.id)}
            >
              <div className={`flex items-center space-x-2 ${getTabColor(tab.type)}`}>
                {getTabIcon(tab.type)}
                <span className="text-sm font-medium text-white whitespace-nowrap">
                  {tab.title}
                </span>
              </div>
              
              {tab.canClose && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Add Tab Buttons */}
        <div className="flex items-center space-x-2 ml-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCreateQueryTab}
            disabled={!isConnected}
            className="text-green-400 hover:bg-green-500/10 hover:text-green-300"
            title="New Query Tab"
          >
            <Plus className="h-4 w-4 mr-1" />
            <Play className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCreateSchemaTab}
            disabled={!isConnected}
            className="text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
            title="New Schema Tab"
          >
            <Plus className="h-4 w-4 mr-1" />
            <Database className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}