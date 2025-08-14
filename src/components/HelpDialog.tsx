import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Keyboard, 
  Database, 
 
  Edit, 
  Search,
  Zap,
  Info
} from "lucide-react";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KeyboardShortcut: React.FC<{ keys: string; description: string }> = ({ keys, description }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-sm text-gray-300">{description}</span>
    <div className="flex items-center space-x-1">
      {keys.split('+').map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-gray-500 text-xs">+</span>}
          <Badge variant="outline" className="text-xs font-mono bg-gray-800 border-gray-600 text-gray-200">
            {key}
          </Badge>
        </React.Fragment>
      ))}
    </div>
  </div>
);

export default function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-xl text-white">
            <Info className="h-6 w-6 text-blue-400" />
            <span>PostgreSQL Query Tool - Help</span>
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Learn how to use the PostgreSQL Query Tool effectively
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Keyboard Shortcuts */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-lg text-white">
                <Keyboard className="h-5 w-5 text-purple-400" />
                <span>Keyboard Shortcuts</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <KeyboardShortcut keys="Ctrl+Enter" description="Execute query" />
              <KeyboardShortcut keys="Ctrl+T" description="New query tab" />
              <KeyboardShortcut keys="Ctrl+W" description="Close current tab" />
              <KeyboardShortcut keys="Ctrl+S" description="Save query" />
              <KeyboardShortcut keys="Ctrl+F" description="Find in query" />
              <KeyboardShortcut keys="Ctrl+B" description="Toggle sidebar" />
              <KeyboardShortcut keys="Ctrl+E" description="Focus query editor" />
              <KeyboardShortcut keys="Ctrl+R" description="Focus results" />
              <KeyboardShortcut keys="Ctrl+Shift+E" description="Export as CSV" />
              <KeyboardShortcut keys="Ctrl+Shift+J" description="Export as JSON" />
              <KeyboardShortcut keys="F5" description="Refresh schema" />
              <KeyboardShortcut keys="F1" description="Show this help" />
            </CardContent>
          </Card>

          {/* Query Features */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-lg text-white">
                <Database className="h-5 w-5 text-green-400" />
                <span>Query Features</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-300">
              <div>
                <h4 className="font-medium text-white mb-1">SQL Execution</h4>
                <p>Write and execute PostgreSQL queries with syntax highlighting and error reporting.</p>
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Query History</h4>
                <p>Access previously executed queries from the history panel.</p>
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Result Pagination</h4>
                <p>Large result sets are automatically paginated for better performance.</p>
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Performance Mode</h4>
                <p>Virtualized rendering automatically activates for datasets with 500+ rows.</p>
              </div>
            </CardContent>
          </Card>

          {/* Schema Explorer */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-lg text-white">
                <Search className="h-5 w-5 text-blue-400" />
                <span>Schema Explorer</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-300">
              <div>
                <h4 className="font-medium text-white mb-1">Table Navigation</h4>
                <p>Click any table to execute a quick SELECT query and view its data.</p>
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Favorites</h4>
                <p>Star frequently used tables to keep them at the top of the list.</p>
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Column Details</h4>
                <p>Expand tables to see columns, data types, constraints, and relationships.</p>
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Foreign Keys</h4>
                <p>Click foreign key relationships to navigate between related tables.</p>
              </div>
            </CardContent>
          </Card>

          {/* Data Editing */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-lg text-white">
                <Edit className="h-5 w-5 text-yellow-400" />
                <span>Data Editing</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-300">
              <div>
                <h4 className="font-medium text-white mb-1">Edit Mode</h4>
                <p>Toggle edit mode to modify table data directly in the results view.</p>
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Cell Editing</h4>
                <p>Click any cell in edit mode to modify its value. Press Enter to save, Escape to cancel.</p>
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Insert & Delete</h4>
                <p>Add new rows or delete existing ones using the action buttons.</p>
              </div>
              <div>
                <h4 className="font-medium text-white mb-1">Data Types</h4>
                <p>Smart input components for different data types: booleans, dates, enums, etc.</p>
              </div>
            </CardContent>
          </Card>

          {/* Export & Performance */}
          <Card className="bg-gray-800/50 border-gray-700 md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center space-x-2 text-lg text-white">
                <Zap className="h-5 w-5 text-orange-400" />
                <span>Export & Performance</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-white mb-1">Export Options</h4>
                  <p>Export query results to CSV or JSON format with customizable options.</p>
                </div>
                <div>
                  <h4 className="font-medium text-white mb-1">Connection Pooling</h4>
                  <p>Optimized connection management for better performance and reliability.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-white mb-1">Streaming Queries</h4>
                  <p>Large datasets are processed in chunks to maintain responsiveness.</p>
                </div>
                <div>
                  <h4 className="font-medium text-white mb-1">Memory Optimization</h4>
                  <p>Virtualized rendering and efficient data structures minimize memory usage.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-300 mb-1">Tips for Better Performance</h4>
              <ul className="text-sm text-blue-200 space-y-1">
                <li>• Use LIMIT clauses for large queries to improve response times</li>
                <li>• Favorite frequently used tables for quick access</li>
                <li>• Use the connection pool status to monitor database performance</li>
                <li>• Export large datasets in chunks rather than all at once</li>
              </ul>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}