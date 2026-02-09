<script>
  import ActionBlock from './ActionBlock.svelte';

  export let blocks = [];
  export let selectedBlock = null;
  export let onBlockSelect = () => {};
  export let onBlockDelete = () => {};
  export let onBlockDuplicate = () => {};
  export let onBlocksChange = () => {};

  let canvasRef;
  let dropIndicatorIndex = -1;

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    // Calculate drop position
    const rect = canvasRef.getBoundingClientRect();
    const y = e.clientY - rect.top + canvasRef.scrollTop;

    // Find insertion index
    const blockElements = canvasRef.querySelectorAll('.block-wrapper');
    let insertIndex = blocks.length;

    for (let i = 0; i < blockElements.length; i++) {
      const blockRect = blockElements[i].getBoundingClientRect();
      const blockY = blockRect.top - rect.top + canvasRef.scrollTop + blockRect.height / 2;
      if (y < blockY) {
        insertIndex = i;
        break;
      }
    }

    dropIndicatorIndex = insertIndex;
  }

  function handleDragLeave(e) {
    if (!canvasRef.contains(e.relatedTarget)) {
      dropIndicatorIndex = -1;
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    dropIndicatorIndex = -1;

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));

      // Calculate insertion index
      const rect = canvasRef.getBoundingClientRect();
      const y = e.clientY - rect.top + canvasRef.scrollTop;

      const blockElements = canvasRef.querySelectorAll('.block-wrapper');
      let insertIndex = blocks.length;

      for (let i = 0; i < blockElements.length; i++) {
        const blockRect = blockElements[i].getBoundingClientRect();
        const blockY = blockRect.top - rect.top + canvasRef.scrollTop + blockRect.height / 2;
        if (y < blockY) {
          insertIndex = i;
          break;
        }
      }

      // Check if this is a move operation (block already in canvas)
      const existingIndex = blocks.findIndex(b => b.id === data.id);

      if (existingIndex !== -1) {
        // Move existing block
        const newBlocks = [...blocks];
        const [movedBlock] = newBlocks.splice(existingIndex, 1);

        // Adjust insert index if moving down
        if (existingIndex < insertIndex) {
          insertIndex--;
        }

        newBlocks.splice(insertIndex, 0, movedBlock);
        onBlocksChange(newBlocks);
      } else {
        // Add new block
        const newBlock = {
          ...data,
          id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        };

        const newBlocks = [...blocks];
        newBlocks.splice(insertIndex, 0, newBlock);
        onBlocksChange(newBlocks);
        onBlockSelect(newBlock);
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  }

  function handleBlockDragStart(e, block, index) {
    e.dataTransfer.setData('application/json', JSON.stringify(block));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDelete(block) {
    const newBlocks = blocks.filter(b => b.id !== block.id);
    onBlocksChange(newBlocks);
    onBlockDelete(block);
    if (selectedBlock?.id === block.id) {
      onBlockSelect(null);
    }
  }

  function handleDuplicate(block) {
    const index = blocks.findIndex(b => b.id === block.id);
    if (index === -1) return;

    const newBlock = {
      ...JSON.parse(JSON.stringify(block)),
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };

    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, newBlock);
    onBlocksChange(newBlocks);
    onBlockSelect(newBlock);
    onBlockDuplicate(block);
  }

  function handleKeyDown(e) {
    if (!selectedBlock) return;

    const index = blocks.findIndex(b => b.id === selectedBlock.id);
    if (index === -1) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      handleDelete(selectedBlock);
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      onBlockSelect(blocks[index - 1]);
    } else if (e.key === 'ArrowDown' && index < blocks.length - 1) {
      e.preventDefault();
      onBlockSelect(blocks[index + 1]);
    } else if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleDuplicate(selectedBlock);
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div
  class="workflow-canvas"
  bind:this={canvasRef}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
  role="list"
  aria-label="Workflow blocks"
>
  {#if blocks.length === 0}
    <div class="empty-state">
      <div class="empty-icon">📋</div>
      <h3>Start Building</h3>
      <p>Drag actions from the palette to create your workflow</p>
    </div>
  {:else}
    <div class="blocks-container">
      {#each blocks as block, index (block.id)}
        {#if dropIndicatorIndex === index}
          <div class="drop-indicator"></div>
        {/if}

        <div
          class="block-wrapper"
          draggable="true"
          on:dragstart={(e) => handleBlockDragStart(e, block, index)}
          role="listitem"
        >
          {#if index > 0}
            <div class="connector">
              <div class="connector-line"></div>
              <div class="connector-arrow">▼</div>
            </div>
          {/if}

          <ActionBlock
            {block}
            selected={selectedBlock?.id === block.id}
            onSelect={onBlockSelect}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
          />
        </div>
      {/each}

      {#if dropIndicatorIndex === blocks.length}
        <div class="drop-indicator"></div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .workflow-canvas {
    flex: 1;
    background: var(--bg-primary, #121212);
    overflow-y: auto;
    padding: 24px;
    min-height: 100%;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 300px;
    color: var(--text-secondary, #666);
    text-align: center;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .empty-state h3 {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .empty-state p {
    margin: 0;
    font-size: 14px;
  }

  .blocks-container {
    max-width: 400px;
    margin: 0 auto;
  }

  .block-wrapper {
    position: relative;
    margin-bottom: 4px;
  }

  .connector {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 0;
  }

  .connector-line {
    width: 2px;
    height: 16px;
    background: var(--border-color, #333);
  }

  .connector-arrow {
    font-size: 8px;
    color: var(--text-secondary, #666);
    margin-top: -4px;
  }

  .drop-indicator {
    height: 4px;
    background: var(--accent-color, #3b82f6);
    border-radius: 2px;
    margin: 8px 0;
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }
</style>
