<script>
  import { onMount } from 'svelte';

  export let nodes = [];
  export let connections = [];
  export let selectedNode = null;
  export let onNodeSelect = () => {};
  export let onNodeDelete = () => {};
  export let onNodesChange = () => {};
  export let onConnectionsChange = () => {};

  let containerRef;

  // Canvas state
  let scale = 1;
  let offsetX = 50;
  let offsetY = 50;
  let isPanning = false;
  let panStart = { x: 0, y: 0 };

  // Dragging state
  let draggedNode = null;
  let dragOffset = { x: 0, y: 0 };

  // Connection drawing state
  let isConnecting = false;
  let connectionStart = null;
  let connectionEnd = { x: 0, y: 0 };

  // Grid settings
  const gridSize = 20;
  const snapToGrid = true;
  const nodeWidth = 180;
  const nodeHeight = 60;

  const categoryColors = {
    navigation: '#3b82f6',
    interaction: '#8b5cf6',
    wait: '#f59e0b',
    data: '#10b981',
    control: '#ef4444',
    advanced: '#6366f1',
  };

  function getNodeColor(node) {
    return categoryColors[node.category] || '#6b7280';
  }

  // Pan handlers
  function handleMouseDown(e) {
    if (e.target === containerRef || e.target.classList.contains('canvas-bg')) {
      if (e.button === 0) {
        isPanning = true;
        panStart = { x: e.clientX - offsetX, y: e.clientY - offsetY };
        e.preventDefault();
      }
      onNodeSelect(null);
    }
  }

  function handleMouseMove(e) {
    if (isPanning) {
      offsetX = e.clientX - panStart.x;
      offsetY = e.clientY - panStart.y;
    } else if (draggedNode) {
      const rect = containerRef.getBoundingClientRect();
      let x = (e.clientX - rect.left - offsetX) / scale - dragOffset.x;
      let y = (e.clientY - rect.top - offsetY) / scale - dragOffset.y;

      if (snapToGrid) {
        x = Math.round(x / gridSize) * gridSize;
        y = Math.round(y / gridSize) * gridSize;
      }

      const updatedNodes = nodes.map(n =>
        n.id === draggedNode.id ? { ...n, x, y } : n
      );
      onNodesChange(updatedNodes);
    } else if (isConnecting) {
      const rect = containerRef.getBoundingClientRect();
      connectionEnd = {
        x: (e.clientX - rect.left - offsetX) / scale,
        y: (e.clientY - rect.top - offsetY) / scale
      };
    }
  }

  function handleMouseUp(e) {
    if (isPanning) {
      isPanning = false;
    }
    if (draggedNode) {
      draggedNode = null;
    }
    if (isConnecting) {
      const rect = containerRef.getBoundingClientRect();
      const x = (e.clientX - rect.left - offsetX) / scale;
      const y = (e.clientY - rect.top - offsetY) / scale;

      const targetNode = nodes.find(n => {
        return x >= n.x - 15 && x <= n.x + 15 &&
               y >= n.y && y <= n.y + nodeHeight;
      });

      if (targetNode && targetNode.id !== connectionStart.nodeId) {
        const exists = connections.some(c =>
          c.from === connectionStart.nodeId && c.to === targetNode.id
        );
        if (!exists) {
          const newConnection = {
            id: `conn-${Date.now()}`,
            from: connectionStart.nodeId,
            to: targetNode.id
          };
          onConnectionsChange([...connections, newConnection]);
        }
      }

      isConnecting = false;
      connectionStart = null;
    }
  }

  function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.3), 2);

    const rect = containerRef.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    offsetX = mouseX - (mouseX - offsetX) * (newScale / scale);
    offsetY = mouseY - (mouseY - offsetY) * (newScale / scale);
    scale = newScale;
  }

  function handleNodeMouseDown(e, node) {
    e.stopPropagation();
    onNodeSelect(node);

    const rect = containerRef.getBoundingClientRect();
    dragOffset = {
      x: (e.clientX - rect.left - offsetX) / scale - node.x,
      y: (e.clientY - rect.top - offsetY) / scale - node.y
    };
    draggedNode = node;
  }

  function handleOutputPortMouseDown(e, node) {
    e.stopPropagation();
    isConnecting = true;
    connectionStart = {
      nodeId: node.id,
      x: node.x + nodeWidth,
      y: node.y + nodeHeight / 2
    };
    connectionEnd = { x: connectionStart.x, y: connectionStart.y };
  }

  function handleNodeDelete(node) {
    const newNodes = nodes.filter(n => n.id !== node.id);
    const newConnections = connections.filter(c => c.from !== node.id && c.to !== node.id);
    onNodesChange(newNodes);
    onConnectionsChange(newConnections);
    onNodeDelete(node);
    if (selectedNode?.id === node.id) {
      onNodeSelect(null);
    }
  }

  function handleConnectionClick(e, conn) {
    e.stopPropagation();
    onConnectionsChange(connections.filter(c => c.id !== conn.id));
  }

  function getBezierPath(fromX, fromY, toX, toY) {
    const dx = Math.abs(toX - fromX);
    const curvature = Math.min(dx * 0.5, 80);
    const cx1 = fromX + curvature;
    const cy1 = fromY;
    const cx2 = toX - curvature;
    const cy2 = toY;
    return `M ${fromX} ${fromY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${toX} ${toY}`;
  }

  function getConnectionPath(conn) {
    const fromNode = nodes.find(n => n.id === conn.from);
    const toNode = nodes.find(n => n.id === conn.to);
    if (!fromNode || !toNode) return '';

    const fromX = fromNode.x + nodeWidth;
    const fromY = fromNode.y + nodeHeight / 2;
    const toX = toNode.x;
    const toY = toNode.y + nodeHeight / 2;

    return getBezierPath(fromX, fromY, toX, toY);
  }

  function handleDrop(e) {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const rect = containerRef.getBoundingClientRect();

      let x = (e.clientX - rect.left - offsetX) / scale;
      let y = (e.clientY - rect.top - offsetY) / scale;

      if (snapToGrid) {
        x = Math.round(x / gridSize) * gridSize;
        y = Math.round(y / gridSize) * gridSize;
      }

      const newNode = {
        ...data,
        id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        x: Math.max(0, x),
        y: Math.max(0, y)
      };

      onNodesChange([...nodes, newNode]);
      onNodeSelect(newNode);
    } catch (err) {
      console.error('Drop error:', err);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function resetView() {
    scale = 1;
    offsetX = 50;
    offsetY = 50;
  }

  function fitView() {
    if (nodes.length === 0) {
      resetView();
      return;
    }

    const padding = 80;
    const minX = Math.min(...nodes.map(n => n.x || 0));
    const minY = Math.min(...nodes.map(n => n.y || 0));
    const maxX = Math.max(...nodes.map(n => (n.x || 0) + nodeWidth));
    const maxY = Math.max(...nodes.map(n => (n.y || 0) + nodeHeight));

    const rect = containerRef?.getBoundingClientRect();
    if (!rect) return;

    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    scale = Math.min(rect.width / contentWidth, rect.height / contentHeight, 1);
    offsetX = padding - minX * scale + (rect.width - contentWidth * scale) / 2;
    offsetY = padding - minY * scale + (rect.height - contentHeight * scale) / 2;
  }

  // Auto-layout nodes if they don't have positions
  $: if (nodes.length > 0 && nodes.some(n => n.x === undefined)) {
    const layoutedNodes = nodes.map((node, index) => {
      if (node.x === undefined || node.y === undefined) {
        return {
          ...node,
          x: 50 + (index % 3) * 250,
          y: 50 + Math.floor(index / 3) * 100
        };
      }
      return node;
    });
    onNodesChange(layoutedNodes);
  }
</script>

<div
  class="node-canvas-container"
  bind:this={containerRef}
  on:wheel={handleWheel}
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:mouseleave={handleMouseUp}
  on:drop={handleDrop}
  on:dragover={handleDragOver}
  role="application"
  aria-label="Workflow canvas"
>
  <!-- Toolbar -->
  <div class="canvas-toolbar">
    <button on:click={resetView} title="Reset view">🏠</button>
    <button on:click={fitView} title="Fit to view">📐</button>
    <span class="zoom-level">{Math.round(scale * 100)}%</span>
  </div>

  <!-- Instructions -->
  <div class="canvas-instructions">
    Drag to pan • Scroll to zoom • Drag from ● to connect
  </div>

  <!-- Grid Background -->
  <div class="canvas-bg" style="
    background-position: {offsetX}px {offsetY}px;
    background-size: {gridSize * scale}px {gridSize * scale}px;
  "></div>

  <!-- SVG for connections -->
  <svg class="connections-layer" style="transform: translate({offsetX}px, {offsetY}px) scale({scale})">
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#888" />
      </marker>
      <marker id="arrowhead-hover" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
        <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
      </marker>
    </defs>

    {#each connections as conn (conn.id)}
      {@const path = getConnectionPath(conn)}
      {#if path}
        <g class="connection" on:click={(e) => handleConnectionClick(e, conn)}>
          <path d={path} class="connection-path" marker-end="url(#arrowhead)" />
          <path d={path} class="connection-hitbox" />
        </g>
      {/if}
    {/each}

    {#if isConnecting && connectionStart}
      <path
        d={getBezierPath(connectionStart.x, connectionStart.y, connectionEnd.x, connectionEnd.y)}
        class="connection-drawing"
      />
    {/if}
  </svg>

  <!-- Nodes Layer -->
  <div class="nodes-layer" style="transform: translate({offsetX}px, {offsetY}px) scale({scale})">
    {#each nodes as node (node.id)}
      <div
        class="node"
        class:selected={selectedNode?.id === node.id}
        style="
          left: {node.x || 0}px;
          top: {node.y || 0}px;
          --node-color: {getNodeColor(node)};
        "
        on:mousedown={(e) => handleNodeMouseDown(e, node)}
        role="button"
        tabindex="0"
      >
        <!-- Input port -->
        <div class="port input-port"></div>

        <!-- Node content -->
        <div class="node-header">
          <span class="node-icon">{node.icon || '📦'}</span>
          <span class="node-name">{node.name || node.type}</span>
        </div>

        {#if node.config}
          <div class="node-preview">
            {#if node.type === 'navigate'}
              {(node.config.url || 'URL...').substring(0, 25)}
            {:else if node.type === 'click' || node.type === 'type'}
              {(node.config.selector || 'selector...').substring(0, 25)}
            {:else if node.type === 'wait-time'}
              {node.config.duration || 0}s
            {:else if node.type === 'evaluate'}
              JS code
            {:else if node.config.message}
              {(node.config.message || '').substring(0, 25)}
            {/if}
          </div>
        {/if}

        <!-- Output port -->
        <div
          class="port output-port"
          on:mousedown={(e) => handleOutputPortMouseDown(e, node)}
        ></div>

        <!-- Delete button -->
        {#if selectedNode?.id === node.id}
          <button
            class="node-delete"
            on:click|stopPropagation={() => handleNodeDelete(node)}
          >×</button>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Empty state -->
  {#if nodes.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🔗</div>
      <h3>Node Workflow Builder</h3>
      <p>Drag actions from the palette to create your workflow</p>
    </div>
  {/if}
</div>

<style>
  .node-canvas-container {
    position: relative;
    flex: 1;
    background: #0d0d0d;
    overflow: hidden;
    cursor: grab;
  }

  .node-canvas-container:active {
    cursor: grabbing;
  }

  .canvas-bg {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, #333 1px, transparent 1px);
    pointer-events: none;
  }

  .canvas-toolbar {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    gap: 6px;
    align-items: center;
    background: rgba(30, 30, 30, 0.95);
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid #333;
    z-index: 100;
  }

  .canvas-toolbar button {
    background: #252525;
    border: 1px solid #444;
    color: #fff;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.15s;
  }

  .canvas-toolbar button:hover {
    background: #333;
    border-color: #555;
  }

  .zoom-level {
    font-size: 12px;
    color: #888;
    margin-left: 6px;
    min-width: 45px;
  }

  .canvas-instructions {
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(30, 30, 30, 0.9);
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 12px;
    color: #666;
    z-index: 100;
    pointer-events: none;
  }

  .connections-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
    transform-origin: 0 0;
  }

  .connection {
    pointer-events: all;
    cursor: pointer;
  }

  .connection-path {
    fill: none;
    stroke: #888;
    stroke-width: 2.5;
    transition: stroke 0.15s;
    filter: drop-shadow(0 0 2px rgba(136, 136, 136, 0.5));
  }

  .connection:hover .connection-path {
    stroke: #ef4444;
    stroke-width: 3;
    filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.6));
  }

  .connection-hitbox {
    fill: none;
    stroke: transparent;
    stroke-width: 20;
  }

  .connection-drawing {
    fill: none;
    stroke: #3b82f6;
    stroke-width: 2;
    stroke-dasharray: 6 4;
  }

  .nodes-layer {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
  }

  .node {
    position: absolute;
    width: 180px;
    min-height: 50px;
    background: linear-gradient(135deg, #1a1a1a 0%, #252525 100%);
    border: 2px solid var(--node-color);
    border-radius: 10px;
    padding: 10px 14px;
    cursor: grab;
    user-select: none;
    transition: box-shadow 0.15s, transform 0.1s;
  }

  .node:hover {
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
    transform: translateY(-2px);
  }

  .node.selected {
    box-shadow: 0 0 0 3px var(--node-color), 0 8px 30px rgba(0, 0, 0, 0.6);
  }

  .node:active {
    cursor: grabbing;
  }

  .node-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .node-icon {
    font-size: 16px;
  }

  .node-name {
    flex: 1;
    font-size: 13px;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .node-preview {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 10px;
    color: #777;
    font-family: 'Monaco', 'Menlo', monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .port {
    position: absolute;
    width: 14px;
    height: 14px;
    background: #1a1a1a;
    border: 3px solid #555;
    border-radius: 50%;
    cursor: crosshair;
    transition: all 0.15s;
    z-index: 10;
  }

  .port:hover {
    background: #3b82f6;
    border-color: #3b82f6;
    transform: scale(1.4);
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
  }

  .input-port {
    left: -7px;
    top: 50%;
    transform: translateY(-50%);
  }

  .input-port:hover {
    transform: translateY(-50%) scale(1.4);
  }

  .output-port {
    right: -7px;
    top: 50%;
    transform: translateY(-50%);
  }

  .output-port:hover {
    transform: translateY(-50%) scale(1.4);
  }

  .node-delete {
    position: absolute;
    top: -10px;
    right: -10px;
    width: 22px;
    height: 22px;
    background: #ef4444;
    border: 2px solid #0d0d0d;
    border-radius: 50%;
    color: white;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: all 0.15s;
  }

  .node-delete:hover {
    background: #dc2626;
    transform: scale(1.1);
  }

  .empty-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: #555;
    pointer-events: none;
  }

  .empty-icon {
    font-size: 56px;
    margin-bottom: 16px;
    opacity: 0.6;
  }

  .empty-state h3 {
    margin: 0 0 10px;
    font-size: 20px;
    font-weight: 600;
    color: #888;
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
  }
</style>
