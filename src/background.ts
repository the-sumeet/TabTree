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
  const tabs = await browser.tabs.query({});

  tabs.forEach(tab => {
    if (tab.id === undefined) return;

    tabTree.set(tab.id, {
      id: tab.id,
      title: tab.title || '',
      url: tab.url || '',
      favIconUrl: tab.favIconUrl,
      openerTabId: tab.openerTabId,
      children: []
    });
  });

  tabTree.forEach((tab) => {
    if (tab.openerTabId && tabTree.has(tab.openerTabId)) {
      const parent = tabTree.get(tab.openerTabId);
      if (parent && !parent.children.includes(tab.id)) {
        parent.children.push(tab.id);
      }
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
  if (tabTree.has(tabId)) {
    const existingTab = tabTree.get(tabId);
    if (existingTab) {
      tabTree.set(tabId, {
        ...existingTab,
        title: tab.title || existingTab.title,
        url: tab.url || existingTab.url,
        favIconUrl: tab.favIconUrl || existingTab.favIconUrl
      });

      await browser.storage.local.set({ tabTree: Array.from(tabTree.entries()) });
    }
  }
});

browser.tabs.onRemoved.addListener(async (tabId) => {
  const tab = tabTree.get(tabId);

  if (tab && tab.openerTabId && tabTree.has(tab.openerTabId)) {
    const parent = tabTree.get(tab.openerTabId);
    if (parent) {
      parent.children = parent.children.filter(id => id !== tabId);
    }
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
