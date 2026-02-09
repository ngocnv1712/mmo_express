<script>
  export let block = {};
  export let selected = false;
  export let onSelect = () => {};
  export let onDelete = () => {};
  export let onDuplicate = () => {};
  export let draggable = true;

  const categoryColors = {
    navigation: '#3b82f6',
    interaction: '#8b5cf6',
    wait: '#f59e0b',
    data: '#10b981',
    control: '#ef4444',
    advanced: '#6366f1',
  };

  $: borderColor = categoryColors[block.category] || '#6b7280';
</script>

<div
  class="action-block"
  class:selected
  style="--border-color: {borderColor}"
  draggable={draggable}
  on:click={() => onSelect(block)}
  on:dragstart={(e) => {
    e.dataTransfer.setData('application/json', JSON.stringify(block));
    e.dataTransfer.effectAllowed = 'move';
  }}
  role="button"
  tabindex="0"
  on:keydown={(e) => e.key === 'Enter' && onSelect(block)}
>
  <div class="block-header">
    <span class="block-icon">{block.icon || '📦'}</span>
    <span class="block-name">{block.name || block.type}</span>
    {#if selected}
      <div class="block-actions">
        <button class="action-btn" on:click|stopPropagation={() => onDuplicate(block)} title="Duplicate">
          📋
        </button>
        <button class="action-btn delete" on:click|stopPropagation={() => onDelete(block)} title="Delete">
          🗑️
        </button>
      </div>
    {/if}
  </div>

  {#if block.config}
    <div class="block-preview">
      {#if block.type === 'navigate'}
        <span class="preview-text">{block.config.url || 'URL...'}</span>
      {:else if block.type === 'click' || block.type === 'type' || block.type === 'fill'}
        <span class="preview-text">{block.config.selector || 'selector...'}</span>
      {:else if block.type === 'wait-time'}
        <span class="preview-text">{block.config.duration || 0}s</span>
      {:else if block.type === 'condition'}
        <span class="preview-text">if {block.config.conditionType || '...'}</span>
      {:else if block.type === 'loop-count'}
        <span class="preview-text">repeat {block.config.count || 0}x</span>
      {:else if block.config.selector}
        <span class="preview-text">{block.config.selector}</span>
      {:else if block.config.message}
        <span class="preview-text">{block.config.message}</span>
      {/if}
    </div>
  {/if}

  {#if block.type === 'condition'}
    <div class="nested-container">
      <div class="nested-branch then">
        <span class="branch-label">✓ Then</span>
        {#if block.then?.length}
          <span class="nested-count">{block.then.length} steps</span>
        {:else}
          <span class="nested-hint">Drop actions here</span>
        {/if}
      </div>
      <div class="nested-branch else">
        <span class="branch-label">✗ Else</span>
        {#if block.else?.length}
          <span class="nested-count">{block.else.length} steps</span>
        {:else}
          <span class="nested-hint">Drop actions here</span>
        {/if}
      </div>
    </div>
  {/if}

  {#if block.type?.startsWith('loop')}
    <div class="nested-container">
      <div class="nested-branch loop">
        <span class="branch-label">🔁 Loop Body</span>
        {#if block.body?.length}
          <span class="nested-count">{block.body.length} steps</span>
        {:else}
          <span class="nested-hint">Drop actions here</span>
        {/if}
      </div>
    </div>
  {/if}

  {#if block.type === 'try-catch'}
    <div class="nested-container">
      <div class="nested-branch try">
        <span class="branch-label">Try</span>
        {#if block.trySteps?.length}
          <span class="nested-count">{block.trySteps.length} steps</span>
        {:else}
          <span class="nested-hint">Drop actions here</span>
        {/if}
      </div>
      <div class="nested-branch catch">
        <span class="branch-label">Catch</span>
        {#if block.catchSteps?.length}
          <span class="nested-count">{block.catchSteps.length} steps</span>
        {:else}
          <span class="nested-hint">Drop actions here</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .action-block {
    background: var(--bg-secondary, #1e1e1e);
    border: 2px solid var(--border-color);
    border-radius: 8px;
    padding: 10px 12px;
    cursor: grab;
    transition: all 0.15s ease;
    user-select: none;
  }

  .action-block:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .action-block.selected {
    box-shadow: 0 0 0 2px var(--border-color), 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .action-block:active {
    cursor: grabbing;
  }

  .block-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .block-icon {
    font-size: 16px;
  }

  .block-name {
    flex: 1;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary, #fff);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .block-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    background: transparent;
    border: none;
    padding: 2px 4px;
    cursor: pointer;
    font-size: 12px;
    opacity: 0.7;
    transition: opacity 0.15s;
  }

  .action-btn:hover {
    opacity: 1;
  }

  .action-btn.delete:hover {
    filter: brightness(1.2);
  }

  .block-preview {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .preview-text {
    font-size: 11px;
    color: var(--text-secondary, #888);
    font-family: monospace;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .block-branches {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }

  .branch-indicator {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
  }

  .branch-indicator.then {
    color: #10b981;
  }

  .branch-indicator.else {
    color: #ef4444;
  }

  .branch-indicator.loop {
    color: #8b5cf6;
  }

  .nested-container {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed rgba(255, 255, 255, 0.2);
  }

  .nested-branch {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    margin-top: 4px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    border: 1px dashed rgba(255, 255, 255, 0.15);
  }

  .nested-branch.then {
    border-color: rgba(16, 185, 129, 0.3);
  }

  .nested-branch.else {
    border-color: rgba(239, 68, 68, 0.3);
  }

  .nested-branch.loop {
    border-color: rgba(139, 92, 246, 0.3);
  }

  .nested-branch.try {
    border-color: rgba(59, 130, 246, 0.3);
  }

  .nested-branch.catch {
    border-color: rgba(245, 158, 11, 0.3);
  }

  .branch-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-secondary, #888);
  }

  .nested-count {
    font-size: 10px;
    color: var(--text-secondary, #888);
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 3px;
  }

  .nested-hint {
    font-size: 10px;
    color: var(--text-secondary, #666);
    font-style: italic;
  }
</style>
