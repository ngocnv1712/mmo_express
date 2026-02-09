<script>
  export let schemas = {};
  export let onDragStart = () => {};

  let expandedCategories = {
    navigation: true,
    interaction: true,
    wait: false,
    data: false,
    control: false,
    advanced: false,
  };

  let searchQuery = '';

  function toggleCategory(category) {
    expandedCategories[category] = !expandedCategories[category];
  }

  function handleDragStart(e, action, category) {
    const block = {
      id: `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: action.type,
      name: action.name,
      icon: action.icon,
      category: category,
      config: getDefaultConfig(action.configSchema),
    };
    e.dataTransfer.setData('application/json', JSON.stringify(block));
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(block);
  }

  function getDefaultConfig(schema) {
    const config = {};
    if (!schema) return config;

    for (const [key, field] of Object.entries(schema)) {
      if (field.default !== undefined) {
        config[key] = field.default;
      } else if (field.type === 'number') {
        config[key] = 0;
      } else if (field.type === 'boolean') {
        config[key] = false;
      } else if (field.type === 'string') {
        config[key] = '';
      }
    }
    return config;
  }

  $: filteredSchemas = (() => {
    if (!searchQuery.trim()) return schemas;

    const query = searchQuery.toLowerCase();
    const filtered = {};

    for (const [catKey, category] of Object.entries(schemas)) {
      const matchingActions = {};
      for (const [actionKey, action] of Object.entries(category.actions || {})) {
        if (
          action.name?.toLowerCase().includes(query) ||
          action.type?.toLowerCase().includes(query) ||
          action.description?.toLowerCase().includes(query)
        ) {
          matchingActions[actionKey] = action;
        }
      }
      if (Object.keys(matchingActions).length > 0) {
        filtered[catKey] = { ...category, actions: matchingActions };
      }
    }
    return filtered;
  })();
</script>

<div class="action-palette">
  <div class="palette-header">
    <h3>Actions</h3>
  </div>

  <div class="search-box">
    <input
      type="text"
      placeholder="Search actions..."
      bind:value={searchQuery}
    />
  </div>

  <div class="categories">
    {#each Object.entries(filteredSchemas) as [catKey, category]}
      <div class="category">
        <button
          class="category-header"
          on:click={() => toggleCategory(catKey)}
        >
          <span class="category-icon">{category.icon}</span>
          <span class="category-name">{category.name}</span>
          <span class="category-count">{Object.keys(category.actions || {}).length}</span>
          <span class="expand-icon">{expandedCategories[catKey] ? '▼' : '▶'}</span>
        </button>

        {#if expandedCategories[catKey]}
          <div class="action-list">
            {#each Object.entries(category.actions || {}) as [actionKey, action]}
              <div
                class="action-item"
                draggable="true"
                on:dragstart={(e) => handleDragStart(e, action, catKey)}
                title={action.description}
                role="button"
                tabindex="0"
              >
                <span class="action-icon">{action.icon}</span>
                <span class="action-name">{action.name}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .action-palette {
    width: 240px;
    background: var(--bg-secondary, #1a1a1a);
    border-right: 1px solid var(--border-color, #333);
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }

  .palette-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .palette-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary, #fff);
  }

  .search-box {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-color, #333);
  }

  .search-box input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid var(--border-color, #333);
    border-radius: 6px;
    background: var(--bg-primary, #121212);
    color: var(--text-primary, #fff);
    font-size: 13px;
  }

  .search-box input::placeholder {
    color: var(--text-secondary, #666);
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--accent-color, #3b82f6);
  }

  .categories {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .category {
    margin-bottom: 4px;
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-primary, #fff);
    font-size: 13px;
    text-align: left;
    transition: background 0.15s;
  }

  .category-header:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .category-icon {
    font-size: 14px;
  }

  .category-name {
    flex: 1;
    font-weight: 500;
  }

  .category-count {
    font-size: 11px;
    color: var(--text-secondary, #666);
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 10px;
  }

  .expand-icon {
    font-size: 10px;
    color: var(--text-secondary, #666);
  }

  .action-list {
    padding: 4px 8px 4px 16px;
  }

  .action-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    margin: 2px 0;
    background: var(--bg-primary, #121212);
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: grab;
    transition: all 0.15s;
    font-size: 12px;
    color: var(--text-primary, #fff);
  }

  .action-item:hover {
    border-color: var(--accent-color, #3b82f6);
    transform: translateX(2px);
  }

  .action-item:active {
    cursor: grabbing;
  }

  .action-icon {
    font-size: 14px;
  }

  .action-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
