<script>
  import { createEventDispatcher } from 'svelte';

  export let selectedCount = 0;
  export let totalCount = 0;
  export let selectAll = false;

  const dispatch = createEventDispatcher();

  function toggleSelectAll() {
    dispatch('toggleSelectAll');
  }

  function handleBulkDelete() {
    dispatch('bulkDelete');
  }

  function handleBulkLaunch() {
    dispatch('bulkLaunch');
  }

  function handleBulkExport() {
    dispatch('bulkExport');
  }

  function handleClearSelection() {
    dispatch('clearSelection');
  }
</script>

<div class="bulk-actions" class:visible={selectedCount > 0}>
  <div class="selection-info">
    <label class="checkbox-wrapper">
      <input type="checkbox" checked={selectAll} on:change={toggleSelectAll} />
      <span class="checkmark"></span>
    </label>
    <span class="count">{selectedCount} of {totalCount} selected</span>
  </div>

  <div class="actions">
    <button class="btn-action launch" on:click={handleBulkLaunch} disabled={selectedCount === 0}>
      ▶ Launch All
    </button>
    <button class="btn-action export" on:click={handleBulkExport} disabled={selectedCount === 0}>
      📤 Export
    </button>
    <button class="btn-action delete" on:click={handleBulkDelete} disabled={selectedCount === 0}>
      🗑️ Delete
    </button>
    <button class="btn-clear" on:click={handleClearSelection}>
      Clear
    </button>
  </div>
</div>

<style>
  .bulk-actions {
    display: none;
    align-items: center;
    justify-content: space-between;
    background: linear-gradient(135deg, #1a2a4e 0%, #16213e 100%);
    border: 1px solid #e94560;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    animation: slideIn 0.2s ease;
  }

  .bulk-actions.visible {
    display: flex;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .selection-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .checkbox-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    cursor: pointer;
  }

  .checkbox-wrapper input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
  }

  .checkmark {
    width: 18px;
    height: 18px;
    border: 2px solid #e94560;
    border-radius: 3px;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .checkbox-wrapper input:checked ~ .checkmark {
    background: #e94560;
  }

  .checkbox-wrapper input:checked ~ .checkmark::after {
    content: '✓';
    color: #fff;
    font-size: 0.75rem;
  }

  .count {
    font-size: 0.9rem;
    color: #e94560;
    font-weight: 500;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-action {
    background: #0f3460;
    border: 1px solid #1a4a7a;
    color: #ccc;
    padding: 0.4rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .btn-action:hover:not(:disabled) {
    border-color: #e94560;
    color: #fff;
  }

  .btn-action:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-action.launch {
    background: rgba(34, 197, 94, 0.2);
    border-color: #22c55e;
    color: #22c55e;
  }

  .btn-action.launch:hover:not(:disabled) {
    background: rgba(34, 197, 94, 0.3);
  }

  .btn-action.delete {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
    color: #ef4444;
  }

  .btn-action.delete:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.3);
  }

  .btn-action.export {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
    color: #3b82f6;
  }

  .btn-action.export:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.3);
  }

  .btn-clear {
    background: none;
    border: none;
    color: #888;
    padding: 0.4rem 0.5rem;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-clear:hover {
    color: #fff;
  }
</style>
