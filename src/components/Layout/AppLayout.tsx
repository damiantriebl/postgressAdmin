import { useState, useEffect, ReactNode } from "react";
import { Database, Settings, Play, CheckCircle, XCircle, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectionStatus } from "@/services/database";

interface AppLayoutProps {
  children: ReactNode;
  connectionStatus: ConnectionStatus | null;
}

interface WindowState {
  sidebarCollapsed: boolean;
  activeTab: string;
  windowSize: {
    width: number;
    height: number;
  };
}

const DEFAULT_WINDOW_STATE: WindowState = {
  sidebarCollapsed: false,
  activeTab: "connection",
  windowSize: {
    width: 1200,
    height: 800
  }
};

export default function AppLayout({ 
  children, 
  connectionStatus
}: AppLayoutProps) {
  const [windowState, setWindowState] = useState<WindowState>(DEFAULT_WINDOW_STATE);
  const [isMobile, setIsMobile] = useState(false);

  // Load window state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('appWindowState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setWindowState(prev => ({ ...prev, ...parsed }));
      } catch (error) {
        console.error('Failed to load window state:', error);
      }
    }
  }, []);

  // Save window state to localStorage
  useEffect(() => {
    localStorage.setItem('appWindowState', JSON.stringify(windowState));
  }, [windowState]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setIsMobile(width < 768);
      setWindowState(prev => ({
        ...prev,
        windowSize: { width, height }
      }));
    };

    handleResize(); // Initial call
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setWindowState(prev => ({
      ...prev,
      sidebarCollapsed: !prev.sidebarCollapsed
    }));
  };

  const handleTabChange = (value: string) => {
    setWindowState(prev => ({
      ...prev,
      activeTab: value
    }));
  };

  return (
    <div className="dark min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800/95 backdrop-blur border-b border-gray-700/50 shadow-sm flex-shrink-0">
        <div className="container flex h-16 items-center justify-between px-6">
          <div className="flex items-center space-x-3">
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSidebar}
                className="text-gray-400 hover:text-white"
              >
                {windowState.sidebarCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </Button>
            )}
            <Database className="h-8 w-8 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">
              PostgreSQL Query Tool
            </h1>
          </div>
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
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className={`
          ${isMobile 
            ? `fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out ${
                windowState.sidebarCollapsed ? '-translate-x-full' : 'translate-x-0'
              }`
            : `relative transition-all duration-300 ease-in-out ${
                windowState.sidebarCollapsed ? 'w-16' : 'w-64'
              }`
          }
          bg-gray-800/90 backdrop-blur-sm border-r border-gray-700/50 flex-shrink-0
        `}>
          <div className="flex flex-col h-full">
            {/* Navigation */}
            <nav className="flex-1 p-4">
              <div className="space-y-2">
                <Button
                  variant={windowState.activeTab === "connection" ? "secondary" : "ghost"}
                  className={`w-full justify-start ${windowState.sidebarCollapsed && !isMobile ? 'px-2' : ''}`}
                  onClick={() => handleTabChange("connection")}
                >
                  <Settings className="h-4 w-4" />
                  {(!windowState.sidebarCollapsed || isMobile) && <span className="ml-2">Connection</span>}
                </Button>
                <Button
                  variant={windowState.activeTab === "query" ? "secondary" : "ghost"}
                  className={`w-full justify-start ${windowState.sidebarCollapsed && !isMobile ? 'px-2' : ''}`}
                  onClick={() => handleTabChange("query")}
                  disabled={!connectionStatus?.connected}
                >
                  <Play className="h-4 w-4" />
                  {(!windowState.sidebarCollapsed || isMobile) && <span className="ml-2">Query</span>}
                </Button>
                <Button
                  variant={windowState.activeTab === "schema" ? "secondary" : "ghost"}
                  className={`w-full justify-start ${windowState.sidebarCollapsed && !isMobile ? 'px-2' : ''}`}
                  onClick={() => handleTabChange("schema")}
                  disabled={!connectionStatus?.connected}
                >
                  <Database className="h-4 w-4" />
                  {(!windowState.sidebarCollapsed || isMobile) && <span className="ml-2">Schema</span>}
                </Button>
              </div>
            </nav>

            {/* Sidebar Toggle (Desktop) */}
            {!isMobile && (
              <div className="p-4 border-t border-gray-700/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  className="w-full text-gray-400 hover:text-white"
                >
                  {windowState.sidebarCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile Overlay */}
        {isMobile && !windowState.sidebarCollapsed && (
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={toggleSidebar}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">
            <Tabs value={windowState.activeTab} onValueChange={handleTabChange} className="w-full">
              {/* Hidden TabsList for state management */}
              <TabsList className="hidden">
                <TabsTrigger value="connection">Connection</TabsTrigger>
                <TabsTrigger value="query">Query</TabsTrigger>
                <TabsTrigger value="schema">Schema</TabsTrigger>
              </TabsList>

              {children}
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}