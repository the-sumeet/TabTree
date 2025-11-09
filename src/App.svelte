<script lang="ts">
  import "./app.css";
  import { onMount } from "svelte";
  import { writable } from "svelte/store";
  import { Sun, Moon } from "@lucide/svelte";

  import {
    SvelteFlow,
    Controls,
    Background,
    MiniMap,
    BackgroundVariant,
    type Node,
    type Edge,
  } from "@xyflow/svelte";

  import "@xyflow/svelte/dist/style.css";
  import browser from "webextension-polyfill";
  import TabNode from "./lib/TabNode.svelte";
  import dagre from "dagre";
  import * as Card from "$lib/components/ui/card/index.js";

  let isDark = $state(false);

  function applyTheme(dark: boolean) {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  function toggleTheme() {
    isDark = !isDark;
    applyTheme(isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  interface TabInfo {
    id: number;
    title: string;
    url: string;
    favIconUrl?: string;
    openerTabId?: number;
    children: number[];
  }

  interface TabNodeData {
    label: string;
    url: string;
    favIconUrl?: string;
  }

  const nodes = writable<Node[]>([]);
  const edges = writable<Edge[]>([]);
  const nodeTypes = { tab: TabNode };
  const NODE_WIDTH = 450;
  const NODE_HEIGHT = 100;

  function convertTabTreeToGraph(tabTreeEntries: [number, TabInfo][]): {
    nodes: Node[];
    edges: Edge[];
  } {
    if (!tabTreeEntries || !Array.isArray(tabTreeEntries)) {
      return { nodes: [], edges: [] };
    }

    const tabMap = new Map<number, TabInfo>(tabTreeEntries);
    const nodeArray: Node[] = [];
    const edgeArray: Edge[] = [];
    const rootTabs: number[] = [];

    nodeArray.push({
      id: "browser",
      type: "tab",
      data: {
        label: "Browser",
        url: "",
        favIconUrl: undefined,
      },
      position: { x: 0, y: 0 },
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });

    tabMap.forEach((tab, tabId) => {
      nodeArray.push({
        id: String(tabId),
        type: "tab",
        data: {
          label: tab.title || "Loading...",
          url: tab.url,
          favIconUrl: tab.favIconUrl,
        },
        position: { x: 0, y: 0 },
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });

      if (!tab.openerTabId) {
        rootTabs.push(tabId);
      }

      tab.children?.forEach((childId) => {
        edgeArray.push({
          id: `e${tabId}-${childId}`,
          source: String(tabId),
          target: String(childId),
          type: "smoothstep",
          animated: false,
          style: "stroke-width: 3;",
        });
      });
    });

    rootTabs.forEach((tabId) => {
      edgeArray.push({
        id: `e-browser-${tabId}`,
        source: "browser",
        target: String(tabId),
        type: "smoothstep",
        animated: false,
        style: "stroke-width: 3;",
      });
    });

    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
      rankdir: "TB",
      ranksep: 150
    });

    edgeArray.forEach((edge) => {
      g.setEdge(edge.source, edge.target);
    });

    nodeArray.forEach((node) => {
      g.setNode(node.id, {
        ...node,
        width: node.measured?.width ?? NODE_WIDTH,
        height: node.measured?.height ?? NODE_HEIGHT,
      });
    });

    dagre.layout(g);

    nodeArray.forEach((node) => {
      const nodeWithPosition = g.node(node.id);
      const width = node.measured?.width ?? NODE_WIDTH;
      const height = node.measured?.height ?? NODE_HEIGHT;

      node.position = {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      };
      node.sourcePosition = 'bottom';
      node.targetPosition = 'top';
    });

    return { nodes: nodeArray, edges: edgeArray };
  }

  async function loadTabData() {
    try {
      const result = await browser.storage.local.get("tabTree");

      if (result.tabTree) {
        const { nodes: newNodes, edges: newEdges } = convertTabTreeToGraph(
          result.tabTree,
        );

        nodes.set(newNodes);
        edges.set(newEdges);
      }
    } catch (error) {
      console.error("Error loading tab data:", error);
    }
  }

  function setupStorageListener() {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes.tabTree && changes.tabTree.newValue) {
        const { nodes: newNodes, edges: newEdges } = convertTabTreeToGraph(
          changes.tabTree.newValue,
        );
        nodes.set(newNodes);
        edges.set(newEdges);
      }
    });
  }

  onMount(() => {
    const savedTheme = localStorage.getItem("theme");
    isDark = savedTheme === "dark";
    applyTheme(isDark);
    loadTabData();
    setupStorageListener();
  });

  async function onNodeClick(event: any): Promise<void> {
    console.log("Node click event:", event);
    const node = event?.detail?.node || event?.node || event;

    if (!node || !node.id) {
      console.error("Could not find node in event:", event);
      return;
    }

    if (node.id === "browser") {
      return;
    }

    const tabId = parseInt(node.id as string);

    try {
      const tab = await browser.tabs.get(tabId);
      if (tab.windowId) {
        await browser.windows.update(tab.windowId, { focused: true });
      }
      await browser.tabs.update(tabId, { active: true });
    } catch (error) {
      console.error("Error switching to tab:", error);
    }
  }
</script>

<div class="h-screen flex flex-col">
  <Card.Root class="flex-1 flex flex-col h-full rounded-none pb-0">
    <Card.Header>
      <Card.Title>Tab Tree</Card.Title>
      <Card.Description>Visualize your browser tabs as a tree</Card.Description>
      <Card.Action>
        <button
          onclick={toggleTheme}
          class="p-2 rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Toggle theme"
        >
          {#if isDark}
            <Sun class="w-5 h-5 text-gray-700 dark:text-gray-200" />
          {:else}
            <Moon class="w-5 h-5 text-gray-700 dark:text-gray-200" />
          {/if}
        </button>
      </Card.Action>
    </Card.Header>
    <Card.Content class="flex-1 p-0 overflow-hidden border-y">
      <div
        class="w-full h-full"
        class:dark={isDark}
      >
        <SvelteFlow
          nodes={$nodes}
          edges={$edges}
          {nodeTypes}
          fitView
          colorMode={isDark ? "dark" : "light"}
          onnodeclick={onNodeClick}
          proOptions={{ hideAttribution: true }}
        >
          <Controls />
          <Background variant={BackgroundVariant.Dots} />
          <MiniMap />
        </SvelteFlow>
      </div>
    </Card.Content>
  </Card.Root>
</div>
