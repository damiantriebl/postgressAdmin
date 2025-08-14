import { useState, useEffect } from "react";

export interface Tab {
  id: string;
  title: string;
  type: 'query' | 'schema' | 'connection';
  content?: any;
  isActive: boolean;
  canClose: boolean;
}

interface TabState {
  tabs: Tab[];
  activeTabId: string;
}

const DEFAULT_TABS: Tab[] = [
  {
    id: 'connection',
    title: 'Connection',
    type: 'connection',
    isActive: true,
    canClose: false
  },
  {
    id: 'schema-explorer',
    title: 'Schema Explorer',
    type: 'schema',
    isActive: false,
    canClose: true
  }
];

export function useTabManager() {
  const [tabState, setTabState] = useState<TabState>({
    tabs: DEFAULT_TABS,
    activeTabId: 'connection'
  });

  // Load tab state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('tabManagerState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // Ensure we always have at least the connection tab
        const tabs = parsed.tabs?.length > 0 ? parsed.tabs : DEFAULT_TABS;
        setTabState({
          tabs,
          activeTabId: parsed.activeTabId || 'connection'
        });
      } catch (error) {
        console.error('Failed to load tab state:', error);
      }
    }
  }, []);

  // Save tab state to localStorage
  useEffect(() => {
    localStorage.setItem('tabManagerState', JSON.stringify(tabState));
  }, [tabState]);

  const createTab = (tab: Omit<Tab, 'id' | 'isActive'>) => {
    const newTab: Tab = {
      ...tab,
      id: `${tab.type}-${Date.now()}`,
      isActive: false
    };

    setTabState(prev => ({
      tabs: [
        ...prev.tabs.map(t => ({ ...t, isActive: false })),
        { ...newTab, isActive: true }
      ],
      activeTabId: newTab.id
    }));

    return newTab.id;
  };

  const switchTab = (tabId: string) => {
    setTabState(prev => ({
      ...prev,
      tabs: prev.tabs.map(tab => ({
        ...tab,
        isActive: tab.id === tabId
      })),
      activeTabId: tabId
    }));
  };

  const closeTab = (tabId: string) => {
    setTabState(prev => {
      const tabToClose = prev.tabs.find(t => t.id === tabId);
      if (!tabToClose?.canClose) {
        return prev;
      }

      const remainingTabs = prev.tabs.filter(t => t.id !== tabId);
      
      // If we're closing the active tab, switch to another tab
      let newActiveTabId = prev.activeTabId;
      if (prev.activeTabId === tabId) {
        // Find the next available tab, preferring the one after the closed tab
        const closedTabIndex = prev.tabs.findIndex(t => t.id === tabId);
        const nextTab = remainingTabs[closedTabIndex] || remainingTabs[closedTabIndex - 1] || remainingTabs[0];
        newActiveTabId = nextTab?.id || 'connection';
      }

      return {
        tabs: remainingTabs.map(tab => ({
          ...tab,
          isActive: tab.id === newActiveTabId
        })),
        activeTabId: newActiveTabId
      };
    });
  };

  const updateTab = (tabId: string, updates: Partial<Tab>) => {
    setTabState(prev => ({
      ...prev,
      tabs: prev.tabs.map(tab =>
        tab.id === tabId ? { ...tab, ...updates } : tab
      )
    }));
  };

  const getActiveTab = () => {
    return tabState.tabs.find(tab => tab.isActive) || tabState.tabs[0];
  };

  const createQueryTab = (title: string = 'New Query', query: string = '') => {
    return createTab({
      title,
      type: 'query',
      content: { query },
      canClose: true
    });
  };

  const createSchemaTab = (title: string = 'Schema Explorer') => {
    return createTab({
      title,
      type: 'schema',
      canClose: true
    });
  };

  return {
    tabs: tabState.tabs,
    activeTabId: tabState.activeTabId,
    activeTab: getActiveTab(),
    createTab,
    createQueryTab,
    createSchemaTab,
    switchTab,
    closeTab,
    updateTab
  };
}