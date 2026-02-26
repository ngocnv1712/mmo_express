<script>
  import { createEventDispatcher } from 'svelte';

  export let searchQuery = '';
  export let filterOS = '';
  export let filterStatus = '';
  export let filterProxy = '';
  export let filterTag = '';
  export let allOS = [];
  export let allTags = [];
  export let allProxies = []; // List of proxy objects { id, name, host, port }
  export let showFilters = false;

  const dispatch = createEventDispatcher();

  function clearFilters() {
    searchQuery = '';
    filterOS = '';
    filterStatus = '';
    filterProxy = '';
    filterTag = '';
    dispatch('change');
  }

  function handleChange() {
    dispatch('change');
  }

  $: hasActiveFilters = filterOS || filterStatus || filterProxy || filterTag;
</script>

<div class="filters-container">
  <!-- Search bar always visible -->
  <div class="search-bar">
    <input
      type="text"
      placeholder="Search profiles..."
      bind:value={searchQuery}
      on:input={handleChange}
      class="search-input"
    />
    <button
      class="btn-filter"
      class:active={showFilters || hasActiveFilters}
      on:click={() => { showFilters = !showFilters; dispatch('toggle'); }}
    >
      🔽 Filters {#if hasActiveFilters}<span class="filter-badge">!</span>{/if}
    </button>
  </div>

  <!-- Filter panel -->
  {#if showFilters}
    <div class="filter-panel">
      <div class="filter-row">
        <div class="filter-group">
          <label>OS</label>
          <select bind:value={filterOS} on:change={handleChange}>
            <option value="">All OS</option>
            {#each allOS as os}
              <option value={os}>{os}</option>
            {/each}
          </select>
        </div>

        <div class="filter-group">
          <label>Status</label>
          <select bind:value={filterStatus} on:change={handleChange}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Proxy</label>
          <select bind:value={filterProxy} on:change={handleChange}>
            <option value="">All Proxies</option>
            <option value="none">No Proxy</option>
            {#each allProxies as proxy}
              <option value={proxy.id}>{proxy.name} ({proxy.host}:{proxy.port})</option>
            {/each}
          </select>
        </div>

        <div class="filter-group">
          <label>Tag</label>
          <select bind:value={filterTag} on:change={handleChange}>
            <option value="">All Tags</option>
            {#each allTags as tag}
              <option value={tag}>{tag}</option>
            {/each}
          </select>
        </div>

        {#if hasActiveFilters}
          <button class="btn-clear" on:click={clearFilters}>
            ✕ Clear
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .filters-container {
    margin-bottom: 1rem;
  }

  .search-bar {
    display: flex;
    gap: 0.5rem;
  }

  .search-input {
    flex: 1;
    background: #0f3460;
    border: 1px solid #1a4a7a;
    color: #fff;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  .search-input:focus {
    outline: none;
    border-color: #e94560;
  }

  .search-input::placeholder {
    color: #666;
  }

  .btn-filter {
    background: #0f3460;
    border: 1px solid #1a4a7a;
    color: #ccc;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    position: relative;
  }

  .btn-filter:hover, .btn-filter.active {
    border-color: #e94560;
    color: #fff;
  }

  .filter-badge {
    position: absolute;
    top: -5px;
    right: -5px;
    background: #e94560;
    color: #fff;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    font-size: 0.7rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .filter-panel {
    background: #16213e;
    border: 1px solid #0f3460;
    border-radius: 8px;
    padding: 1rem;
    margin-top: 0.5rem;
  }

  .filter-row {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 120px;
  }

  .filter-group:nth-child(3) {
    min-width: 180px;
  }

  .filter-group label {
    font-size: 0.75rem;
    color: #888;
    text-transform: uppercase;
  }

  .filter-group select {
    background: #0f3460;
    border: 1px solid #1a4a7a;
    color: #fff;
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .filter-group select:focus {
    outline: none;
    border-color: #e94560;
  }

  .btn-clear {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
    color: #ef4444;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-clear:hover {
    background: rgba(239, 68, 68, 0.3);
  }
</style>
