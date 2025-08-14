import { useEffect, useCallback } from 'react';

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const matchingShortcut = shortcuts.find(shortcut => {
      return (
        shortcut.key.toLowerCase() === event.key.toLowerCase() &&
        !!shortcut.ctrlKey === event.ctrlKey &&
        !!shortcut.shiftKey === event.shiftKey &&
        !!shortcut.altKey === event.altKey &&
        !!shortcut.metaKey === event.metaKey
      );
    });

    if (matchingShortcut) {
      event.preventDefault();
      event.stopPropagation();
      matchingShortcut.action();
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return shortcuts;
};

// Common keyboard shortcuts
export const COMMON_SHORTCUTS = {
  EXECUTE_QUERY: { key: 'Enter', ctrlKey: true, description: 'Execute query' },
  NEW_TAB: { key: 't', ctrlKey: true, description: 'New query tab' },
  CLOSE_TAB: { key: 'w', ctrlKey: true, description: 'Close current tab' },
  SAVE: { key: 's', ctrlKey: true, description: 'Save query' },
  FIND: { key: 'f', ctrlKey: true, description: 'Find in query' },
  TOGGLE_SIDEBAR: { key: 'b', ctrlKey: true, description: 'Toggle sidebar' },
  FOCUS_QUERY_EDITOR: { key: 'e', ctrlKey: true, description: 'Focus query editor' },
  FOCUS_RESULTS: { key: 'r', ctrlKey: true, description: 'Focus results' },
  EXPORT_CSV: { key: 'e', ctrlKey: true, shiftKey: true, description: 'Export as CSV' },
  EXPORT_JSON: { key: 'j', ctrlKey: true, shiftKey: true, description: 'Export as JSON' },
  REFRESH_SCHEMA: { key: 'F5', description: 'Refresh schema' },
  HELP: { key: 'F1', description: 'Show help' },
} as const;