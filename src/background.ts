import browser from 'webextension-polyfill';

interface TabInfo {
  id: number;
  title: string;
  url: string;
  favIconUrl?: string;
  openerTabId?: number;
  children: number[];
}

const tabTree = new Map<number, TabInfo>();

async function initializeTabs(): Promise<void> {
  // First, try to load existing tree from storage
  const stored = await browser.storage.local.get("tabTree");
  if (stored.tabTree && Array.isArray(stored.tabTree)) {
    stored.tabTree.forEach(([id, info]: [number, TabInfo]) => {
      tabTree.set(id, info);
    });
  }

  // Get all current tabs
  const tabs = await browser.tabs.query({});
  const currentTabIds = new Set(tabs.map(t => t.id).filter((id): id is number => id !== undefined));

  // Remove tabs that no longer exist
  const tabIdsToRemove: number[] = [];
  tabTree.forEach((_, tabId) => {
    if (!currentTabIds.has(tabId)) {
      tabIdsToRemove.push(tabId);
    }
  });
  tabIdsToRemove.forEach(id => tabTree.delete(id));

  // Add or update existing tabs
  tabs.forEach(tab => {
    if (tab.id === undefined) return;

    if (!tabTree.has(tab.id)) {
      // New tab, add it
      tabTree.set(tab.id, {
        id: tab.id,
        title: tab.title || '',
        url: tab.url || '',
        favIconUrl: tab.favIconUrl,
        openerTabId: tab.openerTabId,
        children: []
      });

      // Add to parent's children if has opener
      if (tab.openerTabId && tabTree.has(tab.openerTabId)) {
        const parent = tabTree.get(tab.openerTabId);
        if (parent && !parent.children.includes(tab.id)) {
          parent.children.push(tab.id);
        }
      }
    } else {
      // Existing tab, update its info but preserve relationships
      const existingTab = tabTree.get(tab.id)!;
      tabTree.set(tab.id, {
        ...existingTab,
        title: tab.title || existingTab.title,
        url: tab.url || existingTab.url,
        favIconUrl: tab.favIconUrl || existingTab.favIconUrl
      });
    }
  });

  await browser.storage.local.set({ tabTree: Array.from(tabTree.entries()) });
}

browser.tabs.onCreated.addListener(async (tab) => {
  if (tab.id === undefined) return;

  tabTree.set(tab.id, {
    id: tab.id,
    title: tab.title || 'Loading...',
    url: tab.url || '',
    favIconUrl: tab.favIconUrl,
    openerTabId: tab.openerTabId,
    children: []
  });

  if (tab.openerTabId && tabTree.has(tab.openerTabId)) {
    const parent = tabTree.get(tab.openerTabId);
    if (parent && !parent.children.includes(tab.id)) {
      parent.children.push(tab.id);
    }
  }

  await browser.storage.local.set({ tabTree: Array.from(tabTree.entries()) });
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tabTree.has(tabId)) {
    // Tab was created but somehow missed by onCreated, add it now
    tabTree.set(tabId, {
      id: tabId,
      title: tab.title || 'Loading...',
      url: tab.url || '',
      favIconUrl: tab.favIconUrl,
      openerTabId: tab.openerTabId,
      children: []
    });

    if (tab.openerTabId && tabTree.has(tab.openerTabId)) {
      const parent = tabTree.get(tab.openerTabId);
      if (parent && !parent.children.includes(tabId)) {
        parent.children.push(tabId);
      }
    }
  } else {
    const existingTab = tabTree.get(tabId);
    if (existingTab) {
      tabTree.set(tabId, {
        ...existingTab,
        title: tab.title || existingTab.title,
        url: tab.url || existingTab.url,
        favIconUrl: tab.favIconUrl || existingTab.favIconUrl,
        openerTabId: existingTab.openerTabId,
        children: existingTab.children
      });
    }
  }

  await browser.storage.local.set({ tabTree: Array.from(tabTree.entries()) });
});

browser.tabs.onRemoved.addListener(async (tabId) => {
  const tab = tabTree.get(tabId);

  if (tab) {
    // Remove this tab from its parent's children array
    if (tab.openerTabId && tabTree.has(tab.openerTabId)) {
      const parent = tabTree.get(tab.openerTabId);
      if (parent) {
        parent.children = parent.children.filter(id => id !== tabId);
      }
    }

    // Reassign this tab's children to become root tabs (no parent)
    tab.children.forEach(childId => {
      const child = tabTree.get(childId);
      if (child) {
        child.openerTabId = undefined;
      }
    });
  }

  tabTree.delete(tabId);
  await browser.storage.local.set({ tabTree: Array.from(tabTree.entries()) });
});

const actionAPI = browser.action || (browser as any).browserAction;
if (actionAPI) {
  actionAPI.onClicked.addListener(() => {
    browser.tabs.create({ url: browser.runtime.getURL('index.html') });
  });
}

browser.runtime.onInstalled.addListener(() => {
  initializeTabs();
});

initializeTabs();
